import { Component, OnInit, ErrorHandler, ViewChild, ElementRef, Renderer2, OnDestroy } from '@angular/core';
import nlp from 'compromise';
declare global {
  interface Window {
    AudioContext: any;
    webkitAudioContext: any;
  }
  // interface Navigator {
  //   getUserMedia(
  //     options: { video?: bool; audio?: bool; },
  //     success: (stream: any) => void,
  //     error?: (error: string) => void
  //   ): void;
  //   webkitGetUserMedia(
  //     options: { video?: bool; audio?: bool; },
  //     success: (stream: any) => void,
  //     error?: (error: string) => void
  //   ): void;
  //   mozGetUserMedia(
  //     options: { video?: bool; audio?: bool; },
  //     success: (stream: any) => void,
  //     error?: (error: string) => void
  //   ): void;
  //   msGetUserMedia(
  //     options: { video?: bool; audio?: bool; },
  //     success: (stream: any) => void,
  //     error?: (error: string) => void
  //   ): void;
  // }
  // interface WindowEventMap {
  //   open: CustomEvent;
  //   close: CustomEvent;
  //   message: CustomEvent;
  // }
}
@Component({
  selector: 'app-websocket',
  templateUrl: './websocket.component.html',
  styleUrls: ['./websocket.component.scss']
})
export class WebsocketComponent implements OnInit, OnDestroy {
  socket: any;
  bufferSize = 4096;
  streamStreaming = false;
  context: any;
  audioIn: any;
  recorder: any;
  globalStream: any;
  AudioContext: any;

  finalWord = false;
  @ViewChild('ResultText', { static: false }) resultText: ElementRef;
  removeLastSentence = true;
  showAudioDiv = false;
  recordedText = '';
  showLabelBox = false;
  recordedLabel: any;
  constructor(private renderer: Renderer2, ) {
    window.onbeforeunload = (e: any) => {
      if (this.streamStreaming) {
        this.onStop();
      }
    };
  }

  ngOnInit() {
  }
  ngOnDestroy() {
    if (this.streamStreaming) {
     this.onStop();
    }
  }
  onRecord() {
    this.socket = new WebSocket('ws://demos.kaazing.com/echo');
    this.initSocket();
  }

  initSocket() {

    this.socket.onopen = (event: any) => {
      this.startRecording(this.onAudio.bind(this)).then(() => {
        console.log('Recording');
      }).catch((error) => {
        console.log(error);
      });
    };
    this.socket.onmessage = (event: any) => {
      // console.log(event.data);
      this.handleOutputText(event.data);
    };
    this.socket.onclose = (event: any) => {
      // console.log('Stopped Transcoding & Recording stopped');
    };
  }
  main() {
    if (!this.init()) {
      alert('Your browser does not support websockets / audio context.');
      return;
    }
  }
  // tslint:disable-next-line:align
  init() {
    try {
      // Shims
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      // tslint:disable-next-line:max-line-length
      // navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    } catch (e) {
      console.error(e);
      return false;
    }

    return (navigator.getUserMedia && window.AudioContext);
  }
  /**
   * Starts recording audio from the computers microphone,
   * and has the data hit a javascript function.
   */
  startRecording(callback) {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
      this.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext({
        latencyHint: 'interactive'
      });
      this.globalStream = stream;
      this.streamStreaming = true;
      // send metadata on audio stream to backend
      this.socket.send(JSON.stringify({
        sampleRateHz: this.context.sampleRate,
        language: 'en-US',
        format: 'LINEAR16'
      }));

      // Capture mic audio data into a stream
      this.audioIn = this.context.createMediaStreamSource(stream);

      // only record mono audio and call a js function after a buffer of
      // size this.bufferSize is full
      this.recorder = this.context.createScriptProcessor(this.bufferSize, 1, 1);

      // specify the processing function
      this.recorder.onaudioprocess = callback;

      // connect audioIn data to the recorder
      this.audioIn.connect(this.recorder);

      // connect recorder's output to previous destination
      this.recorder.connect(this.context.destination);
    });
  }
  /**
   * Converts audio stored as float32 to be Linear 16 bit PCM
   * data. Aka FLOAT322->INT16
   */
  float32ToLinear16(float32Arr: any) {
    const int16 = new Int16Array(float32Arr.length);
    for (let i = 0; i < float32Arr.length; ++i) {
      // force number in [-1, 1]
      const s = Math.max(-1, Math.min(1, float32Arr[i]));

      // convert 32 bit float -> 16 bit int.
      // 0x7fff = max 16 bit num. 0x8000 = min 16 bit num.
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }
  onAudio(event: any) {
    const float32Audio = event.inputBuffer.getChannelData(0) || new Float32Array(this.bufferSize);
    const linear16 = this.float32ToLinear16(float32Audio);
    this.socket.send(linear16.buffer);
    console.log(linear16.buffer);
  }
  onStop() {
    if (this.streamStreaming) {
      this.streamStreaming = false;
      const track = this.globalStream.getTracks()[0];
      track.stop();

      this.audioIn.disconnect(this.recorder);
      this.recorder.disconnect(this.context.destination);
      this.context.close().then(() => {
        this.audioIn = null;
        this.recorder = null;
        this.context = null;
        this.AudioContext = null;
      });
    }
    this.socket.close();
  }
  // handle the output from websocket
  handleOutputText(data: any) {
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
      const edit = this.addTimeSettingsInterim(data);

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
      const edit = this.addTimeSettingsFinal(data);
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

  }
  // ================= Juggling Spans for nlp Coloring =================
 addTimeSettingsInterim(speechData: any) {
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
  }
  addTimeSettingsFinal(speechData: any) {
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
  }
  capitalize(s: string) {
    if (s.length < 1) {
      return s;
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
