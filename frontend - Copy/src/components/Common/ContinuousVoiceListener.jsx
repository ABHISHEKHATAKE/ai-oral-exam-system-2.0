import React, { useRef, useState, useEffect } from 'react';

export function ContinuousVoiceListener({ onAudioChunk, isExamActive = true, onSilenceDetected }) {
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioStreamRef = useRef(null);
  const processorRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const recordingIntervalRef = useRef(null);
  const chunksRef = useRef([]);
  const isSilentRef = useRef(false);
  const SILENCE_THRESHOLD = 30;
  const SILENCE_DURATION = 2000; // 2 seconds of silence to trigger processing

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  useEffect(() => {
    checkMicrophoneSupport();
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      stopListening();
    };
  }, []);

  const checkMicrophoneSupport = async () => {
    try {
      const hasGetUserMedia = !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      );

      if (!hasGetUserMedia) {
        setError('❌ Your browser does not support voice features. Use Chrome, Firefox, or Edge.');
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudio = devices.some(device => device.kind === 'audioinput');
        
        if (!hasAudio) {
          setError('❌ No microphone found. Please connect a microphone.');
          return;
        }

        setError('');
      } catch (err) {
        console.log('Could not enumerate devices:', err);
      }
    } catch (err) {
      console.error('Error checking microphone support:', err);
      setError('❌ Could not check microphone availability');
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      setError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        }
      });

      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      setShowPermissionGuide(false);
      
      return true;
    } catch (err) {
      console.error('Microphone permission error:', err.name, err.message);
      
      let errorMsg = '';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = '❌ Microphone permission denied. Please enable it in browser settings.';
        setShowPermissionGuide(true);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = '❌ No microphone found. Please connect a microphone.';
      } else if (err.name === 'NotReadableError') {
        errorMsg = '❌ Microphone is being used by another app. Please close other apps using microphone.';
      } else if (err.name === 'SecurityError') {
        errorMsg = '❌ HTTPS required for microphone access (except on localhost).';
      } else {
        errorMsg = `❌ Microphone error: ${err.message}`;
      }
      
      setError(errorMsg);
      return false;
    }
  };

  const startListening = async () => {
    try {
      setError('');
      
      if (!permissionGranted) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          return;
        }
      }

      chunksRef.current = [];
      isSilentRef.current = false;

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // We want raw audio for analysis
        }
      });

      audioStreamRef.current = stream;

      // Setup Web Audio API for real-time analysis
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser for volume detection
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Create processor for continuous audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      analyser.connect(processor);
      processor.connect(audioContext.destination);

      // Handle audio data
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const db = 20 * Math.log10(Math.max(rms, 0.001));
        const normalizedVolume = Math.max(0, Math.min(100, db + 100)); // 0-100
        setVolumeLevel(normalizedVolume);

        // Detect silence
        if (normalizedVolume < SILENCE_THRESHOLD) {
          if (!isSilentRef.current) {
            isSilentRef.current = true;
            
            // Set timeout to process audio after silence
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = setTimeout(() => {
              if (isSilentRef.current && chunksRef.current.length > 0) {
                // Auto-process the audio when silence detected
                if (onSilenceDetected) {
                  onSilenceDetected();
                }
                // Automatically send final chunk
                processPendingAudio();
              }
            }, SILENCE_DURATION);
          }
        } else {
          // Speech detected
          if (isSilentRef.current) {
            isSilentRef.current = false;
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
            }
          }
        }
      };

      // Create MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          
          // Send audio chunk to WebSocket
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            if (onAudioChunk) {
              onAudioChunk({
                audio: base64Audio,
                is_final: false,
                silence_duration: 0,
                mode: 'voice'
              });
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(500); // Send chunks every 500ms
      setIsListening(true);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('❌ Microphone permission denied. Please enable it in browser settings.');
        setShowPermissionGuide(true);
      } else if (err.name === 'NotFoundError') {
        setError('❌ No microphone found. Please connect a microphone.');
      } else if (err.name === 'NotReadableError') {
        setError('❌ Microphone is being used by another app. Please close other apps.');
      } else {
        setError(`❌ Error: ${err.message}`);
      }
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Stop audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      setRecordingTime(0);
      setVolumeLevel(0);
    }
  };

  const processPendingAudio = () => {
    if (chunksRef.current.length > 0) {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];
        if (onAudioChunk) {
          onAudioChunk({
            audio: base64Audio,
            is_final: true,
            silence_duration: recordingTime,
            mode: 'voice'
          });
        }
      };
      reader.readAsDataURL(audioBlob);
      chunksRef.current = [];
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="continuous-voice-listener card border-0 shadow-sm p-4 mb-3">
      <style>{`
        .listening-animation {
          display: inline-block;
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
          margin-right: 8px;
        }
        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
        .volume-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin: 10px 0;
        }
        .volume-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #ef4444 100%);
          transition: width 0.1s ease;
        }
        .browser-steps {
          margin-top: 10px;
          background: #f3f4f6;
          padding: 10px;
          border-radius: 4px;
          font-size: 0.85rem;
        }
      `}</style>

      {showPermissionGuide && (
        <div className="alert alert-warning mb-3">
          <strong>🔐 How to Enable Microphone Permission:</strong>
          <div className="browser-steps mt-2">
            <p><strong>Chrome/Edge:</strong></p>
            <ol style={{paddingLeft: '20px', marginBottom: '10px'}}>
              <li>Look for the microphone icon 🔴 in the address bar</li>
              <li>Click it and select "Allow"</li>
              <li>Try the exam again</li>
            </ol>
            
            <p><strong>Firefox:</strong></p>
            <ol style={{paddingLeft: '20px', marginBottom: '10px'}}>
              <li>A permission request will popup</li>
              <li>Click "Allow"</li>
              <li>Try the exam again</li>
            </ol>

            <p><strong>If still not working:</strong></p>
            <ul style={{paddingLeft: '20px'}}>
              <li>Close all other browser tabs using microphone</li>
              <li>Restart your browser</li>
              <li>Check if microphone works in other apps</li>
              <li>Try a different browser</li>
            </ul>
          </div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="flex-grow-1">
          <h6 className="mb-0 fw-bold">
            {isListening && <span className="listening-animation"></span>}
            🎤 Voice Listening
          </h6>
          {isListening && (
            <small className="text-muted d-block mt-2">
              Speaking time: {formatTime(recordingTime)}
            </small>
          )}
        </div>

        <div className="btn-group" role="group">
          {!isListening ? (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={startListening}
              disabled={!isExamActive}
            >
              🎤 Start Listening
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={processPendingAudio}
              >
                ⏸ Process Answer
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={stopListening}
              >
                ⏹ Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Volume Level Indicator */}
      {isListening && (
        <div className="mb-3">
          <small className="text-muted d-block mb-2">Volume Level: {Math.round(volumeLevel)}%</small>
          <div className="volume-bar">
            <div 
              className="volume-fill" 
              style={{ width: `${Math.min(100, volumeLevel)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Info Messages */}
      {isListening && (
        <div className="alert alert-info alert-sm mb-0 py-2">
          <small>
            <strong>💡 Auto-Detection Active:</strong> Speak naturally. The system will automatically process your answer after {SILENCE_DURATION / 1000} seconds of silence.
          </small>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-3 mb-0">
          <strong>⚠️ Microphone Issue:</strong>
          <div>{error}</div>
          {error.includes('denied') && (
            <button 
              className="btn btn-sm btn-outline-danger mt-2"
              onClick={() => requestMicrophonePermission()}
            >
              🔄 Retry Permission
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ContinuousVoiceListener;
