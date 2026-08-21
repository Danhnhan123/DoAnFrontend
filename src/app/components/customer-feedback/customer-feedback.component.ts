import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { CustomerFeedback, FEEDBACK_STATUSES, FEEDBACK_TYPES } from '../../models/customer-feedback';
import { OutboundOrderDetail, OutboundOrderRow, OUTBOUND_STATUS_CODE } from '../../models/outbound-order';
import { CustomerFeedbackService } from '../../services/customer-feedback.service';
import { OutboundOrderService } from '../../services/outbound-order.service';

@Component({ selector: 'app-customer-feedback', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './customer-feedback.component.html', styleUrl: './customer-feedback.component.css' })
export class CustomerFeedbackComponent {
  private feedbacks = inject(CustomerFeedbackService); private outboundsApi = inject(OutboundOrderService); private router = inject(Router);
  rows = signal<CustomerFeedback[]>([]); outbounds = signal<OutboundOrderRow[]>([]); detail = signal<CustomerFeedback | null>(null);
  source = signal<OutboundOrderDetail | null>(null); busy = signal(false); showCreate = signal(false); search = '';
  types = FEEDBACK_TYPES; statuses = FEEDBACK_STATUSES;
  form = { outboundOrderId: null as number | null, outboundOrderItemId: null as number | null, paddyLotBagAllocationId: null as number | null, feedbackType: 'QUALITY', severity: 'MEDIUM', description: '' };
  constructor() { void this.load(); }
  private unwrap<T>(r: any): T { if (r?.status >= 400 || r?.isSucceeded === false) throw new Error(r?.message || 'Yêu cầu thất bại'); return (r?.resources ?? r?.data ?? r) as T; }
  async load() { this.busy.set(true); try { const [f, o] = await Promise.all([lastValueFrom(this.feedbacks.list(0, 200, this.search)), lastValueFrom(this.outboundsApi.getPaged({page:1,pageSize:1000}))]); this.rows.set(this.unwrap<any>(f).data || []); this.outbounds.set((this.unwrap<any>(o).items || []).filter((x: OutboundOrderRow) => x.outboundStatusCode === OUTBOUND_STATUS_CODE.COMPLETED)); } catch(e:any){ void Swal.fire('Không tải được dữ liệu', e.message, 'error'); } finally { this.busy.set(false); } }
  async select(id: number) { try { this.detail.set(this.unwrap(await lastValueFrom(this.feedbacks.get(id)))); } catch(e:any){ void Swal.fire('Lỗi',e.message,'error'); } }
  async chooseOutbound(value: any) { const id=Number(value)||null; this.form.outboundOrderId=id; this.form.outboundOrderItemId=null; this.form.paddyLotBagAllocationId=null; this.source.set(null); if(id) this.source.set(this.unwrap(await lastValueFrom(this.outboundsApi.getById(id)))); }
  selectedItem() { return this.source()?.items.find(x => x.id === Number(this.form.outboundOrderItemId)); }
  availableBags() { const s=this.source(), item=this.selectedItem(); if(!s) return []; if(!item) return s.bagAllocations; const lots=new Set(item.allocations.map(a=>a.paddyLotId)); return s.bagAllocations.filter(b=>lots.has(b.lotId)); }
  async create() { const source=this.source(); if(!source || !this.form.description.trim()) return void Swal.fire('Thiếu thông tin','Chọn phiếu đã giao và nhập nội dung khiếu nại.','warning'); this.busy.set(true); try { await lastValueFrom(this.feedbacks.create({salesOrderId:source.salesOrderId,outboundOrderId:source.id,outboundOrderItemId:this.form.outboundOrderItemId,productVariantId:this.selectedItem()?.productVariantId,paddyLotBagAllocationId:this.form.paddyLotBagAllocationId,feedbackType:this.form.feedbackType,severity:this.form.severity,description:this.form.description.trim()})); this.showCreate.set(false); this.form.description=''; await this.load(); void Swal.fire('Thành công','Đã ghi nhận khiếu nại.','success'); } catch(e:any){ void Swal.fire('Không thể tạo',e?.error?.message||e.message,'error'); } finally {this.busy.set(false);} }
  async updateStatus() { const d=this.detail(); if(!d)return; const result=await Swal.fire({title:'Cập nhật xử lý',input:'select',inputOptions:Object.fromEntries(this.statuses.map(x=>[x,x])),inputValue:d.resolutionStatus,showCancelButton:true}); if(!result.value)return; const note=await Swal.fire({title:'Ghi chú xử lý',input:'textarea',inputValue:d.resolutionNote||'',showCancelButton:true}); if(note.dismiss)return; await lastValueFrom(this.feedbacks.resolve(d.id,result.value,note.value)); await this.load(); await this.select(d.id); }
  async trace() { const d=this.detail(); if(!d)return; try { const data=this.unwrap(await lastValueFrom(this.feedbacks.trace(d.id))); await Swal.fire({title:'Chuỗi truy vết điều tra',html:`<pre style="text-align:left;max-height:60vh;overflow:auto">${this.escape(JSON.stringify(data,null,2))}</pre>`,width:900}); } catch(e:any){ void Swal.fire('Không truy vết được',e?.error?.message||e.message,'error'); } }
  createReturn(){const d=this.detail(); if(!d)return; void this.router.navigate(['/admin/customer-returns'],{queryParams:{feedbackId:d.id,outboundId:d.outboundOrderId,reason:d.description}});}
  private escape(s:string){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));}
  labelType(v:string){return ({QUALITY:'Chất lượng',WRONG_PRODUCT:'Sai sản phẩm',WEIGHT:'Khối lượng',PACKAGING:'Bao bì',DELIVERY:'Giao hàng',OTHER:'Khác'} as any)[v]||v;}
}
