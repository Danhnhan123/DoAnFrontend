import { HttpClient, HttpParams, HttpResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import {
  ApiResponse,
  BatchQrLabelPrintRequest,
  QrLabelHistoryQuery,
  QrLabelHistoryResult,
  QrLabelPreview,
  QrLabelSummary,
  QrLabelTemplate,
  QrLabelType,
} from "../models";

@Injectable({ providedIn: "root" })
export class QrLabelService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getSummary(): Observable<ApiResponse<QrLabelSummary>> {
    return this.http.get<ApiResponse<QrLabelSummary>>(
      `${this.base}/qr-labels/summary`,
    );
  }

  getHistory(
    query: QrLabelHistoryQuery,
  ): Observable<ApiResponse<QrLabelHistoryResult>> {
    return this.http.post<ApiResponse<QrLabelHistoryResult>>(
      `${this.base}/qr-labels/history/paged`,
      query,
    );
  }

  getPreview(
    labelType: QrLabelType,
    subjectId: number,
    template: QrLabelTemplate,
  ): Observable<ApiResponse<QrLabelPreview>> {
    const params = new HttpParams()
      .set("labelType", labelType)
      .set("subjectId", subjectId)
      .set("template", template);
    return this.http.get<ApiResponse<QrLabelPreview>>(
      `${this.base}/qr-labels/preview`,
      { params },
    );
  }

  generateFile(
    labelType: QrLabelType,
    request: BatchQrLabelPrintRequest,
  ): Observable<HttpResponse<Blob>> {
    if (labelType === "SKU") {
      const dimensions = this.templateDimensions(request.template);
      return this.http.post(
        `${this.base}/product-variant/batch/qr-labels`,
        {
          items: request.ids.map((id) => ({
            productVariantId: id,
            quantity: request.copiesPerLabel,
          })),
          widthMm: dimensions.widthMm,
          heightMm: dimensions.heightMm,
        },
        { observe: "response", responseType: "blob" },
      );
    }

    const pathByType: Record<Exclude<QrLabelType, "SKU">, string> = {
      PADDY_LOT: "paddy-lots",
      BAG: "bags",
      LOCATION: "locations",
    };
    return this.http.post(
      `${this.base}/qr-labels/${pathByType[labelType]}/batch`,
      request,
      { observe: "response", responseType: "blob" },
    );
  }

  private templateDimensions(template: QrLabelTemplate): {
    widthMm: number;
    heightMm: number;
  } {
    if (template === "SMALL") return { widthMm: 50, heightMm: 30 };
    if (template === "LARGE") return { widthMm: 100, heightMm: 70 };
    return { widthMm: 70, heightMm: 50 };
  }
}
