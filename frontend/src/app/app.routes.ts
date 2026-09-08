import { Routes } from '@angular/router';
import { guestGuard } from './core/auth/guest.guard';
import { authGuard } from './core/auth/auth.guard';
import { doctorGuard } from './core/auth/doctor.guard';
import { adminGuard } from './core/auth/admin.guard';
import { pharmaGuard } from './core/auth/pharma.guard';
import { sysAdminGuard } from './core/auth/sysadmin.guard';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'doctor',
    component: AppShellComponent,
    canActivate: [authGuard, doctorGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/doctor-dashboard/doctor-dashboard.component').then(m => m.DoctorDashboardComponent) },
      { path: 'patients', loadComponent: () => import('./features/patients/patients-list.component').then(m => m.PatientsListComponent) },
      { path: 'followups', loadComponent: () => import('./features/followup-calendar/followup-calendar.component').then(m => m.FollowupCalendarComponent) },
      { path: 'patients/new', loadComponent: () => import('./features/patients/register-patient.component').then(m => m.RegisterPatientComponent) },
      { path: 'patients/:id', loadComponent: () => import('./features/patients/patient-detail.component').then(m => m.PatientDetailComponent) },
      { path: 'assessments/new', loadComponent: () => import('./features/assessments/assessment-form.component').then(m => m.AssessmentFormComponent) },
      { path: 'assessments/:id', loadComponent: () => import('./features/assessments/assessment-form.component').then(m => m.AssessmentFormComponent) },
    ]
  },
  {
    path: 'admin',
    component: AppShellComponent,
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'analytics', pathMatch: 'full' },
      { path: 'analytics', loadComponent: () => import('./features/analytics-admin/admin-analytics.component').then(m => m.AdminAnalyticsComponent) },
      { path: 'diseases', loadComponent: () => import('./features/diseases/diseases.component').then(m => m.DiseasesComponent) },
      { path: 'templates', loadComponent: () => import('./features/templates/templates-list.component').then(m => m.TemplatesListComponent) },
      { path: 'templates/new', loadComponent: () => import('./features/templates/template-builder.component').then(m => m.TemplateBuilderComponent) },
      { path: 'templates/:id', loadComponent: () => import('./features/templates/template-builder.component').then(m => m.TemplateBuilderComponent) },
      { path: 'doctors', loadComponent: () => import('./features/doctors/doctors.component').then(m => m.DoctorsComponent) },
      { path: 'audit', loadComponent: () => import('./features/audit-log/audit-log.component').then(m => m.AuditLogComponent) },
      { path: 'statistics', loadComponent: () => import('./features/statistics/statistics.component').then(m => m.StatisticsComponent) },
      { path: 'patients', loadComponent: () => import('./features/patients/patients-list.component').then(m => m.PatientsListComponent) },
      { path: 'patients/new', loadComponent: () => import('./features/patients/register-patient.component').then(m => m.RegisterPatientComponent) },
      { path: 'patients/:id', loadComponent: () => import('./features/patients/patient-detail.component').then(m => m.PatientDetailComponent) },
    ]
  },
  {
    path: 'pharma',
    component: AppShellComponent,
    canActivate: [authGuard, pharmaGuard],
    children: [
      { path: '', redirectTo: 'analytics', pathMatch: 'full' },
      { path: 'analytics', loadComponent: () => import('./features/analytics-pharma/pharma-analytics.component').then(m => m.PharmaAnalyticsComponent) },
    ]
  },
  {
    path: 'sysadmin',
    component: AppShellComponent,
    canActivate: [authGuard, sysAdminGuard],
    children: [
      { path: '', redirectTo: 'config', pathMatch: 'full' },
      { path: 'config', loadComponent: () => import('./features/system-config/system-config.component').then(m => m.SystemConfigComponent) },
      { path: 'users', loadComponent: () => import('./features/system-config/user-management.component').then(m => m.UserManagementComponent) },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
