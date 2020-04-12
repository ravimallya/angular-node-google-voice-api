import { TestBed } from '@angular/core/testing';

import { GoogleTranscribeService } from './google-transcribe.service';

describe('GoogleTranscribeService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GoogleTranscribeService = TestBed.get(GoogleTranscribeService);
    expect(service).toBeTruthy();
  });
});
