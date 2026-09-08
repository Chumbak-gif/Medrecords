import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-page">
      <div class="card login-card">
        <div class="login-logo">
          <img src="assets/logo.png" alt="Emcure Logo" class="logo-img" />
        </div>

        <div class="login-header">
          <h1 class="login-title">MEDRecords</h1>
          <p class="login-subtitle">Doctor-Patient Assessment Portal</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="form-field">
            <label for="username">Username</label>
            <input
              id="username"
              type="text"
              formControlName="username"
              placeholder="Enter your username"
              autocomplete="username"
              [class.is-invalid]="form.get('username')?.invalid && form.get('username')?.touched"
            />
            @if (form.get('username')?.invalid && form.get('username')?.touched) {
              <span class="field-error">Username is required</span>
            }
          </div>

          <div class="form-field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Enter your password"
              autocomplete="current-password"
              [class.is-invalid]="form.get('password')?.invalid && form.get('password')?.touched"
            />
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <span class="field-error">Password is required</span>
            }
          </div>

          @if (errorMsg()) {
            <div class="alert alert-error" role="alert">
              {{ errorMsg() }}
            </div>
          }

          <button
            type="submit"
            class="btn-primary login-btn"
            [disabled]="form.invalid || isLoading()"
          >
            @if (isLoading()) {
              <span class="spinner" aria-hidden="true"></span>
              Signing in...
            } @else {
              Sign In
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-ground, #f4f6fb);
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 48px 40px 40px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      background: var(--surface-card);
    }

    .login-logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .logo-img {
      height: 52px;
      object-fit: contain;
    }

    .login-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .login-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--emcure-red, #C8102E);
      margin: 0 0 6px;
      letter-spacing: -0.5px;
    }

    .login-subtitle {
      font-size: 0.9rem;
      color: var(--text-secondary, #6c757d);
      margin: 0;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
    }

    .form-field label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary, #212529);
    }

    .form-field input {
      padding: 10px 14px;
      border: 1.5px solid var(--border-color, #dee2e6);
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;
      background: #fff;
      color: var(--text-primary, #212529);
    }

    .form-field input:focus {
      border-color: var(--emcure-red, #C8102E);
      box-shadow: 0 0 0 3px rgba(200, 16, 46, 0.12);
    }

    .form-field input.is-invalid {
      border-color: #dc3545;
    }

    .field-error {
      font-size: 0.8rem;
      color: #dc3545;
    }

    .alert-error {
      background: #fff5f5;
      border: 1px solid #f5c2c7;
      border-radius: 6px;
      color: #842029;
      padding: 10px 14px;
      font-size: 0.875rem;
      margin-bottom: 20px;
    }

    .login-btn {
      width: 100%;
      padding: 12px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .login-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.auth.login(this.form.value.username!, this.form.value.password!)
      .subscribe({
        next: (resp) => {
          this.isLoading.set(false);
          const roleDashboard: Record<string, string> = {
            doctor: '/doctor/dashboard',
            admin: '/admin/analytics',
            pharma_viewer: '/pharma/analytics',
            sys_admin: '/sysadmin/config'
          };
          this.router.navigate([roleDashboard[resp.role] ?? '/login']);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMsg.set(err?.error?.detail ?? 'Login failed. Please try again.');
        }
      });
  }
}
