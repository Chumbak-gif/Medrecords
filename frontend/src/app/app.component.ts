import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  title = 'medrecords';

  ngOnInit(): void {
    // On refresh: if token exists, reload profile — sidebar will react via signal
    if (this.auth.getToken()) {
      this.auth.loadProfile();
    }
  }
}
