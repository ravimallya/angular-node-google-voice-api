import { Component, OnInit, OnDestroy, TemplateRef, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { AudioRecordingService } from 'src/app/_services/audio-recording.service';
import { DomSanitizer } from '@angular/platform-browser';
import { GoogleTranscribeService } from 'src/app/_services/google-transcribe.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap';
import { TranscribedData } from 'src/app/_interfaces/transcribed-data';

import * as socketIo from 'socket.io-client';
import { Socket } from 'src/app/_interfaces/socket';
import { Observer, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import nlp from 'compromise';

declare global {
  interface Window {
    AudioContext: any;
    webkitAudioContext: any;
  }
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  isRecording = false;
  recordedTime: any;
  blobUrl: any;
  transcribedData: TranscribedData[] = [];
  modalRecordRef: BsModalRef;
  modalConfig = {
    backdrop: true,
    ignoreBackdropClick: true,
    keyboard: false,
    animated: true
  };
  recordedFile: any;
  @ViewChild('audioElement', { static: true }) audioElement: ElementRef;
  socket: Socket = socketIo(environment.socketUri);
  observer: Observer<string>;
  // audioStream constraints
  constraints = {
    audio: true,
    video: false
  };
  bufferSize = 2048;
  processor: any;
  input: any;
  globalStream: any;

  AudioContext: any;

  context: any;

  finalWord = false;
  @ViewChild('ResultText', { static: false }) resultText: ElementRef;
  removeLastSentence = true;
  streamStreaming = false;
  showAudioDiv = false;
  recordedText = '';
  showLabelBox = false;
  recordedLabel: any;
  constructor(
    private audioRecordingService: AudioRecordingService,
    private sanitizer: DomSanitizer,
    private modalService: BsModalService,
    private googleTranscribeService: GoogleTranscribeService,
    private renderer: Renderer2,
  ) {

    window.onbeforeunload = (e: any) => {
      if (this.streamStreaming) {
        this.socket.emit('endGoogleCloudStream', '');
      }
    };
    // this.audioRecordingService.recordingFailed().subscribe(() => {
    //   this.isRecording = false;
    // });

    // this.audioRecordingService.getRecordedTime().subscribe((time) => {
    //   this.recordedTime = time;
    // });

    // this.audioRecordingService.getRecordedBlob().subscribe((data) => {
    //   this.blobUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(data.blob));
    // });
    // this.globalStream = {};
    // this.input = {};
  }

  ngOnInit() {
    this.connectSocket();
  }
  ngOnDestroy() {
    if (this.streamStreaming) {
      this.socket.emit('endGoogleCloudStream', '');
    }
  }
  connectSocket() {
    this.socket.on('connect', (res: any) => {
      console.log(res);
    });
    this.socket.emit('join', 'Server Connected to Client from Angular');

    this.socket.on('messages', (data: any) => {
      console.log(data);
    });

    this.socket.on('speechData', (data: any) => {
      // console.log(data);
      const dataFinal = undefined || data.results[0].isFinal;

      if (dataFinal === false) {
        // console.log(resultText.lastElementChild);
        if (this.removeLastSentence) {
          this.resultText.nativeElement.lastElementChild.remove();
        }
        this.removeLastSentence = true;

        // add empty span
        const empty = this.renderer.createElement('span');
        this.resultText.nativeElement.appendChild(empty);

        // add children to empty span
        const edit = addTimeSettingsInterim(data);

        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < edit.length; i++) {
          this.resultText.nativeElement.lastElementChild.appendChild(edit[i]);
          this.resultText.nativeElement.lastElementChild.appendChild(document.createTextNode('\u00A0'));
        }

      } else if (dataFinal === true) {
        this.resultText.nativeElement.lastElementChild.remove();

        // add empty span
        const empty = this.renderer.createElement('span');
        this.resultText.nativeElement.appendChild(empty);

        // add children to empty span
        const edit = addTimeSettingsFinal(data);
        for (let i = 0; i < edit.length; i++) {
          if (i === 0) {
            edit[i].innerText = this.capitalize(edit[i].innerText);
          }
          this.resultText.nativeElement.lastElementChild.appendChild(edit[i]);

          if (i !== edit.length - 1) {
            this.resultText.nativeElement.lastElementChild.appendChild(document.createTextNode('\u00A0'));
          }
        }
        this.resultText.nativeElement.lastElementChild.appendChild(document.createTextNode('\u002E\u00A0'));

        console.log('Google Speech sent \'final\' Sentence.');
        this.finalWord = true;

        this.removeLastSentence = false;
      }
    });


    // ================= Juggling Spans for nlp Coloring =================
    const addTimeSettingsInterim = (speechData: any) => {
      const wholeString = speechData.results[0].alternatives[0].transcript;
      console.log('wholeString', wholeString);
      this.recordedText = this.recordedText + wholeString;
      const nlpObject = nlp(wholeString).out('terms');
      console.log('nlpObject', nlpObject);

      const wordWithoutTime = [];

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < nlpObject.length; i++) {
        // data
        const word = nlpObject[i];
        const tags = [];

        // generate span
        const newSpan = this.renderer.createElement('span');
        newSpan.innerHTML = word;

        // push all tags
        // for (let j = 0; j < nlpObject[i].tags.length; j++) {
        //   tags.push(nlpObject[i].tags[j]);
        // }

        // add all classes
        // for (let j = 0; j < nlpObject[i].tags.length; j++) {
        //   const cleanClassName = tags[j];
        //   // console.log(tags);
        //   const className = `nl-${cleanClassName}`;
        //   newSpan.classList.add(className);
        // }

        wordWithoutTime.push(newSpan);
      }

      this.finalWord = false;

      return wordWithoutTime;
    };

    const addTimeSettingsFinal = (speechData: any) => {
      const wholeString = speechData.results[0].alternatives[0].transcript;

      const nlpObject = nlp(wholeString).out('terms');
      console.log('nlpObject', nlpObject);
      const words = speechData.results[0].alternatives[0].words;
      console.log('words', words);

      const wordsInTime = [];

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < words.length; i++) {
        // data
        const word = words[i].word;
        const startTime = `${words[i].startTime.seconds}.${words[i].startTime.nanos}`;
        const endTime = `${words[i].endTime.seconds}.${words[i].endTime.nanos}`;
        const tags = [];

        // generate span
        const newSpan = this.renderer.createElement('span');
        newSpan.innerHTML = word;
        newSpan.dataset.startTime = startTime;

        // // push all tags
        // for (let j = 0; j < nlpObject[i].tags.length; j++) {
        //   tags.push(nlpObject[i].tags[j]);
        // }

        // //add all classes
        // for (let j = 0; j < nlpObject[i].tags.length; j++) {
        //   let cleanClassName = nlpObject[i].tags[j];
        //   // console.log(tags);
        //   let className = `nl-${cleanClassName}`;
        //   newSpan.classList.add(className);
        // }

        wordsInTime.push(newSpan);
      }

      return wordsInTime;
    };
  }

  showRecord() {
    this.showAudioDiv = true;
  }
  startStreamRecording() {
    this.initRecording();
  }
  pauseStreamRecording() {
    if (this.streamStreaming) {
      this.streamStreaming = false;
      this.socket.emit('endGoogleCloudStream', '');


      const track = this.globalStream.getTracks()[0];
      track.stop();

      this.input.disconnect(this.processor);
      this.processor.disconnect(this.context.destination);
      this.context.close().then(() => {
        this.input = null;
        this.processor = null;
        this.context = null;
        this.AudioContext = null;
      });

    }
  }

  initRecording() {
    this.socket.emit('startGoogleCloudStream', ''); // init socket Google Speech Connection
    this.streamStreaming = true;
    this.AudioContext = window.AudioContext || window.webkitAudioContext;

    this.context = new AudioContext({
      // if Non-interactive, use 'playback' or 'balanced' // https://developer.mozilla.org/en-US/docs/Web/API/AudioContextLatencyCategory
      latencyHint: 'interactive',
    });

    this.processor = this.context.createScriptProcessor(this.bufferSize, 1, 1);
    this.processor.connect(this.context.destination);
    this.context.resume();

    const handleSuccess = (stream: any) => {
      this.globalStream = stream;
      this.input = this.context.createMediaStreamSource(stream);
      this.input.connect(this.processor);

      this.processor.onaudioprocess = (e) => {
        this.microphoneProcess(e);
      };
    };
    navigator.mediaDevices.getUserMedia(this.constraints).then(handleSuccess);
  }

  microphoneProcess(e: any) {
    const left = e.inputBuffer.getChannelData(0);
    // var left16 = convertFloat32ToInt16(left); // old 32 to 16 function
    const left16 = this.downsampleBuffer(left, 44100, 16000);
  //  console.log('left', left);
    // console.log('left16', left16);
    this.socket.emit('binaryData', left16);
  }
  downsampleBuffer(buffer: any, sampleRate: number, outSampleRate: number) {
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

  stopRecording() {
    // waited for FinalWord
    this.streamStreaming = false;
    this.socket.emit('endGoogleCloudStream', '');


    const track = this.globalStream.getTracks()[0];
    track.stop();

    this.input.disconnect(this.processor);
    this.processor.disconnect(this.context.destination);
    this.context.close().then(() => {
      this.input = null;
      this.processor = null;
      this.context = null;
      this.AudioContext = null;
    });

    // context.close();


    // audiovideostream.stop();

    // microphone_stream.disconnect(script_processor_node);
    // script_processor_node.disconnect(audioContext.destination);
    // microphone_stream = null;
    // script_processor_node = null;

    // audiovideostream.stop();
    // videoElement.srcObject = null;
  }
  stopStreamRecording(template: TemplateRef<any>) {
    this.modalRecordRef = this.modalService.show(template, this.modalConfig);
    this.pauseStreamRecording();
  }
  onYesModal() {
    this.modalRecordRef.hide();
    this.pauseStreamRecording();
    this.showLabelBox = true;
  }
  onNoModal() {
    this.modalRecordRef.hide();
    this.startStreamRecording();
  }
  onSubmitLabel(labelText: string) {
    this.showLabelBox = false;
    this.showAudioDiv = false;
    const finalText = this.resultText.nativeElement.innerText;
    console.log(finalText);
    this.resultText.nativeElement.removeChild();
  }
  capitalize(s: string) {
    if (s.length < 1) {
      return s;
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // startRecording() {
  //   if (!this.isRecording) {
  //     this.isRecording = true;
  //     this.audioRecordingService.startRecording();
  //   }
  // }

  // abortRecording() {
  //   if (this.isRecording) {
  //     this.isRecording = false;
  //     this.audioRecordingService.abortRecording();
  //   }
  // }

  // stopRecording() {
  //   if (this.isRecording) {
  //     this.audioRecordingService.getRecordedBlob().subscribe(async (data) => {
  //       this.recordedFile = data;
  //     });
  //     this.audioRecordingService.stopRecording();
  //     this.isRecording = false;
  //     //  this.getTranscribed();
  //   }
  // }

  // clearRecordedData() {
  //   this.blobUrl = null;
  //   this.recordedFile = null;
  // }



  // ngOnDestroy(): void {
  //   this.abortRecording();
  // }
  // // open recording modal
  // onRecordAudio(template: TemplateRef<any>) {
  //   this.clearRecordedData();
  //   this.modalRecordRef = this.modalService.show(template, this.modalConfig);
  // }
  // // get transcribled data
  // async getTranscribed() {
  //   const formData = new FormData();
  //   formData.append('audio_data',  this.recordedFile.blob,  this.recordedFile.title);
  //   await this.googleTranscribeService.postAudio(formData).then(res => {
  //     if (res !== '') {
  //       this.transcribedData.push({
  //         text: res,
  //         time: new Date()
  //       });
  //     }
  //     console.log(this.transcribedData);
  //     this.modalRecordRef.hide();
  //   }, err => {
  //     console.log(err);
  //   });

  // }
  // onCloseModal() {
  //   this.clearRecordedData();
  //   this.modalRecordRef.hide();

  // }
}

