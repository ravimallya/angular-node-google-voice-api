import { Injectable } from '@angular/core';

import * as RecordRTC from 'recordrtc';
import * as moment from 'moment';
import { Subject, Observable } from 'rxjs';
import { RecordedAudioOutput } from '../_interfaces/recorded-audio-output';
import { buffer } from 'rxjs/operators';
import { WebsocketService } from './websocket.service';

@Injectable({
  providedIn: 'root'
})
export class AudioRecordingService {
  isPaused = false;
  stream: any;
  recorder: any;
  interval: any;
  startTime: moment.MomentInput;
  IsRecorded = new Subject<RecordedAudioOutput>();
  recordingTime = new Subject<string>();
  IsRecordingFailed = new Subject<string>();
  constructor(private websocketService: WebsocketService) { }


  getRecordedBlob(): Observable<RecordedAudioOutput> {
    return this.IsRecorded.asObservable();
  }

  getRecordedTime(): Observable<string> {
    return this.recordingTime.asObservable();
  }

  recordingFailed(): Observable<string> {
    return this.IsRecordingFailed.asObservable();
  }


  startRecording() {
    if (this.recorder) {
      return;
    }
    this.websocketService.connectSocket().subscribe(data => {
      console.log(data);
    });
    this.recordingTime.next('00:00');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
      this.stream = s;
      this.record();
    }).catch(error => {
      this.IsRecordingFailed.next();
    });

  }
  pauseRecording() {
    if (this.recorder) {
      this.recorder.pause();
      this.isPaused = true;
    }
  }
  abortRecording() {
    this.stopMedia();
  }

  private record() {

    this.recorder = new RecordRTC.StereoAudioRecorder(this.stream, {
      type: 'audio',
      numberOfAudioChannels: 1,
      mimeType: 'audio/wav',

      // value in milliseconds
      timeSlice: 1000,
      // requires timeSlice above
      // returns blob via callback function
      ondataavailable(blob: any) {
        // this.websocketService._send(blob);
        new Response(blob).arrayBuffer()
          .then((bufer) => {
            console.log(buffer);
            if (bufer) {
              this.websocketService.startRecording(bufer).then(data => {
                console.log(data);
              });
            }
          });
      },
    });

    this.recorder.record();
    this.startTime = moment();
    this.interval = setInterval(
      () => {
        const currentTime = moment();
        const diffTime = moment.duration(currentTime.diff(this.startTime));
        const time = this.toString(diffTime.minutes()) + ':' + this.toString(diffTime.seconds());
        this.recordingTime.next(time);
      },
      1000
    );
  }

  private toString(value) {
    let val = value;
    if (!value) {
      val = '00';
    }
    if (value < 10) {
      val = '0' + value;
    }
    return val;
  }

  stopRecording() {

    if (this.recorder) {
      this.recorder.stop((blob: any) => {
        if (this.startTime) {
          const mp3Name = encodeURIComponent('audio_' + new Date().getTime() + '.mp3');
          this.stopMedia();
          this.IsRecorded.next({ blob, title: mp3Name });
        }
      }, () => {
        this.stopMedia();
        this.IsRecordingFailed.next();
      });
    }
  }

  private stopMedia() {
    if (this.recorder) {
      this.recorder = null;
      clearInterval(this.interval);
      this.startTime = null;
      if (this.stream) {
        this.stream.getAudioTracks().forEach(track => track.stop());
        this.stream = null;
      }
    }
  }
}
