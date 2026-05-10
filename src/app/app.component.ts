import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  themeService = inject(ThemeService);

  ngOnInit(): void {
    // Apply saved theme on app start
    document.documentElement.setAttribute('data-theme', this.themeService.theme());
  }
}