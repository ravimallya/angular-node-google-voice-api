import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, tap, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class GoogleTranscribeService {
  apiUrl = '/api/upload_sound';
  constructor(private http: HttpClient) { }
  async postAudio(file: any) {
    console.log('service triggered');

    try {
      try {
        const va = await this.http.post(this.apiUrl, file, { responseType: 'text' }).toPromise();
        return va;
      } catch (error) {
        console.log(error);
        return error;
      }
    } catch (val) {
      console.log(val);
    }
  }

}
