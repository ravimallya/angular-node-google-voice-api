import { Injectable } from '@angular/core';
import * as socketIo from 'socket.io-client';
import { Socket } from 'src/app/_interfaces/socket';
import { Observer, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

declare const io: {
  connect(url: string): Socket;
};
@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  socket: Socket = socketIo(environment.socketUri);
  observer: Observer<string>;

  constructor() { }


  connectSocket(): Observable<string> {
    this.socket.on('connect', (res) => {
      this.observer.next(res);
    });

    this.socket.on('messages', (data) => {
      console.log(data);
    });
    this.socket.emit('join', 'Server Connected to Client from Angular');
    return this.createObservable();
  }

  startRecording(chunk) {
    this.socket.emit('startGoogleCloudStream', ''); // init socket Google Speech Connection
    this.microphoneProcess(chunk);
  }
  createObservable(): Observable<string> {
    return new Observable<string>(observer => {
      this.observer = observer;
    });
  }
  microphoneProcess(e) {
    const left = e.inputBuffer.getChannelData(0);
    // const left16 = convertFloat32ToInt16(left); // old 32 to 16 function
    const left16 = this.downsampleBuffer(left, 44100, 16000);
    this.socket.emit('binaryData', left16);
  }

  downsampleBuffer(buffer, sampleRate, outSampleRate) {
    if (outSampleRate === sampleRate) {
      return buffer;
    }
    if (outSampleRate > sampleRate) {
      throw new Error('downsampling rate show be smaller than original sample rate');
    }
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }

      result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result.buffer;
  }

}
