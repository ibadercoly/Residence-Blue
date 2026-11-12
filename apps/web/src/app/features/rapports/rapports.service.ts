// apps/web/src/app/features/rapports/rapports.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RapportsDto } from '@residence-blue/api'; // assuming shared types exported via barrel

@Injectable({ providedIn: 'root' })
export class RapportsService {
  private readonly baseUrl = '/api/rapports';
  constructor(private http: HttpClient) {}

  getRapports(periode: string): Observable<RapportsDto> {
    const params = new HttpParams().set('periode', periode);
    return this.http.get<RapportsDto>(this.baseUrl, { params });
  }

  exportPdf(periode: string): Observable<Blob> {
    const params = new HttpParams().set('periode', periode);
    return this.http.get(`${this.baseUrl}/export/pdf`, { params, responseType: 'blob' });
  }

  exportExcel(periode: string): Observable<Blob> {
    const params = new HttpParams().set('periode', periode);
    return this.http.get(`${this.baseUrl}/export/excel`, { params, responseType: 'blob' });
  }
}
