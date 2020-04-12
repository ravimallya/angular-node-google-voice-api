const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer();
async function testGoogleTextToSpeech(audioBuffer) {
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();

    const audio = {
        content: audioBuffer.toString('base64'),
    };
    const config = {
        languageCode: 'en-US',
    };
    const request = {
        audio: audio,
        config: config,
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    return transcription;
}

router.post('/upload_sound', upload.any(), async(req, res) => {
    console.log(req)
    console.log("Getting text transcription..");
    let transcription = await testGoogleTextToSpeech(req.files[0].buffer);
    console.log("Text transcription: " + transcription);
    res.status(200).send(transcription);
});


module.exports = router;
// ng build --prod && node bin/www