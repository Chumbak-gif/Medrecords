import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, switchMap, tap } from 'rxjs';
import { AuthResponse, UserProfile } from './models/auth.models';
import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiBaseUrl;
const TOKEN_KEY = 'med_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<UserProfile | null>(null);
  isAuthenticated = computed(() => !!this.currentUser());

  /** Reactive role signal — templates read this directly for reactivity */
  readonly role = computed(() => this.currentUser()?.role ?? null);

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/api/v1/auth/login`, { username, password })
      .pipe(
        tap((response) => this.storeToken(response.access_token)),
        switchMap((response) =>
          this.http.get<UserProfile>(`${API_BASE_URL}/api/v1/auth/me`).pipe(
            tap((profile) => this.currentUser.set(profile)),
            switchMap(() => of(response))
          )
        )
      );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http
        .post(`${API_BASE_URL}/api/v1/auth/logout`, {})
        .subscribe({ error: (err: any) => console.error('[API Error]', err) });
    }
    this.clearToken();
    this.currentUser.set(null);
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  loadProfile(): void {
    this.http
      .get<UserProfile>(`${API_BASE_URL}/api/v1/auth/me`)
      .subscribe({
        next: (profile) => this.currentUser.set(profile),
        error: () => {
          this.clearToken();
          this.currentUser.set(null);
        }
      });
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.role === role;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  storeToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
