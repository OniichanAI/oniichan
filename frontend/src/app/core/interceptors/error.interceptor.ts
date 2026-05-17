import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../feedback/toast.service';

const SILENT_PATHS = ['/api/v1/auth/me'];

function shouldSurface(url: string, status: number): boolean {
  if (status === 401) return false; // guards handle redirect; not user-actionable
  if (SILENT_PATHS.some((path) => url.includes(path))) return false;
  return true;
}

function extractMessage(err: HttpErrorResponse): string {
  const detail = (err.error as { detail?: unknown })?.detail;
  if (typeof detail === 'string') return detail;
  if (err.status === 0) return 'Server unreachable.';
  return err.message || `Request failed (${err.status}).`;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && shouldSurface(req.url, err.status)) {
        toast.error(extractMessage(err));
      }
      return throwError(() => err);
    }),
  );
};
