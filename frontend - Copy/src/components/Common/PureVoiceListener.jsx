import React, { useRef, useState, useEffect } from 'react';

/**
 * PureVoiceListener - Completely silent voice mode
 * No buttons, no text display, just pure voice conversation
 * Auto-detects pauses and processes answers
 */
export function PureVoiceListener({ onAudioChunk, isExamActive = true }) {
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
  const silenceCounterRef = useRef(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const speechStartTimeRef = useRef(null);
  const speechTimeoutRef = useRef(null); // 10-second auto-submit timer
  
  // 10 second auto-submit timer (instead of silence detection)
  const SPEECH_TIMEOUT = 10000; // 10 seconds - auto-submit after 10s of any speech
  const SILENCE_THRESHOLD = 15; // dB threshold for silence detection (backup)
  const SILENCE_DURATION = 3000; // 3 seconds minimum pause (backup)
  const MAX_SILENCE_DURATION = 5000; // 5 seconds maximum pause
  const MIN_SPEECH_DURATION = 300; // Minimum speech before considering for auto-submit

  useEffect(() => {
    checkMicrophoneSupport();
    // Auto-start listening when exam becomes active
    if (isExamActive && !isListening) {
      setTimeout(() => startListening(), 500);
    }

    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      stopListening();
    };
  }, [isExamActive]);

  const checkMicrophoneSupport = async () => {
    try {
      const hasGetUserMedia = !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      );

      if (!hasGetUserMedia) {
        setError('Browser does not support voice features');
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudio = devices.some(device => device.kind === 'audioinput');
        
        if (!hasAudio) {
          setError('No microphone found');
          return;
        }

        setError('');
      } catch (err) {
        console.log('Could not enumerate devices:', err);
      }
    } catch (err) {
      console.error('Error checking microphone support:', err);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      setError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      
      return true;
    } catch (err) {
      console.error('Microphone permission error:', err.name);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found');
      } else if (err.name === 'NotReadableError') {
        setError('Microphone is in use');
      } else {
        setError(`Microphone error: ${err.message}`);
      }
      
      return false;
    }
  };

  const startListening = async () => {
    try {
      setError('');
      console.log('🎙️ startListening called');
      
      if (!permissionGranted) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          console.log('❌ Microphone permission not granted');
          return;
        }
      }

      console.log('🎙️ Requesting microphone access...');
      chunksRef.current = [];
      isSilentRef.current = false;
      silenceCounterRef.current = 0;
      speechStartTimeRef.current = null; // Reset speech start time

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      console.log('✅ Got microphone stream');

      audioStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      analyser.connect(processor);
      processor.connect(audioContext.destination);

      // Real-time audio analysis for silence detection
      let lastLogTime = 0;
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const db = 20 * Math.log10(Math.max(rms, 0.001));
        const normalizedVolume = Math.max(0, Math.min(100, (db + 100) * 0.6)); // Scale to 0-60 range
        setVolumeLevel(normalizedVolume);

        // Log volume every 2 seconds
        const now = Date.now();
        if (now - lastLogTime > 2000) {
          console.log(`🔊 Volume: ${normalizedVolume.toFixed(1)}, Speaking: ${normalizedVolume > SILENCE_THRESHOLD}, Silent: ${isSilentRef.current}`);
          lastLogTime = now;
        }

        // Improved silence detection logic
        // Speech is detected when volume is above threshold
        const isSpeech = normalizedVolume > SILENCE_THRESHOLD;
        
        if (isSpeech) {
          // User is speaking - track speech start time if not already tracking
          if (!speechStartTimeRef.current) {
            console.log('🎙️ SPEECH DETECTED - Starting 10-second timer');
            speechStartTimeRef.current = Date.now();
            
            // Set 10-second auto-submit timer
            if (speechTimeoutRef.current) {
              clearTimeout(speechTimeoutRef.current);
            }
            speechTimeoutRef.current = setTimeout(() => {
              console.log('⏱️  10 SECONDS ELAPSED - Auto-submitting answer');
              if (chunksRef.current.length > 0) {
                processPendingAudio();
              }
            }, SPEECH_TIMEOUT);
          }
          
          // Reset silence detection if we were in silence
          if (isSilentRef.current) {
            isSilentRef.current = false;
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }
          }
          silenceCounterRef.current = 0;
        } else {
          // Silence detected - but with 10s timer, we don't need silence detection
          // Just keep the 10-second timer running
          silenceCounterRef.current++;
        }
      };

      // MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('🎙️ Audio chunk received, size:', event.data.size, 'bytes');
          chunksRef.current.push(event.data);
          
          // Send audio chunks to server
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            console.log('🎙️ Converted to base64, length:', base64Audio?.length);
            if (onAudioChunk) {
              console.log('🎙️ Calling onAudioChunk with audio');
              onAudioChunk({
                audio: base64Audio,
                is_final: false,
                mode: 'pure_voice'
              });
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      console.log('🎙️ Starting MediaRecorder with 500ms intervals');
      mediaRecorder.start(500); // Send chunks every 500ms
      setIsListening(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(`Microphone error: ${err.message}`);
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

      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      setRecordingTime(0);
      setVolumeLevel(0);
    }
  };

  const processPendingAudio = () => {
    console.log('🎤 processPendingAudio called with', chunksRef.current.length, 'chunks');
    
    // Clear the 10-second timer
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    
    if (chunksRef.current.length > 0) {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      console.log('🎤 Created audio blob, size:', audioBlob.size, 'bytes');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];
        console.log('🎤 Converted to base64, length:', base64Audio?.length);
        console.log('✅ SENDING ANSWER NOW - FINAL AUDIO');
        
        if (onAudioChunk) {
          console.log('🎤 Sending FINAL audio chunk with is_final=true');
          onAudioChunk({
            audio: base64Audio,
            is_final: true,
            mode: 'pure_voice',
            duration: recordingTime
          });
        } else {
          console.log('❌ onAudioChunk callback not provided');
        }
      };
      reader.readAsDataURL(audioBlob);
      chunksRef.current = [];
      speechStartTimeRef.current = null; // Reset speech tracking for next answer
      setRecordingTime(0);
    } else {
      console.log('❌ No audio chunks to process');
    }
  };

  return (
    <div className="pure-voice-listener">
      <style>{`
        .pure-voice-listener {
          position: relative;
          width: 100%;
        }
        
        .voice-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 20px;
          border-radius: 12px;
          background: linear-gradient(135deg, #764ba2 0%, #f093fb 100%);
          color: white;
        }
        
        .listening-dot {
          display: inline-block;
          width: 20px;
          height: 20px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse-voice 1s infinite;
        }
        
        @keyframes pulse-voice {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% { 
            opacity: 0.7;
            transform: scale(1.1);
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.3);
          }
        }
        
        .volume-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .volume-bars {
          display: flex;
          gap: 3px;
          align-items: flex-end;
          height: 30px;
        }
        
        .volume-bar {
          width: 4px;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 2px;
          transition: height 0.1s ease;
        }
        
        .status-text {
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        
        .error-message {
          color: #ef4444;
          font-size: 14px;
          text-align: center;
          padding: 10px;
          background: #fef2f2;
          border-radius: 8px;
          margin-top: 10px;
        }
      `}</style>

      {!isListening && !error && (
        <div className="voice-status">
          <div className="listening-dot"></div>
          <div className="status-text">🎤 Listening...</div>
        </div>
      )}

      {isListening && !error && (
        <div className="voice-status">
          <div className="listening-dot"></div>
          <div className="volume-indicator">
            <div className="volume-bars">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="volume-bar"
                  style={{
                    height: `${Math.max(2, (volumeLevel / 100) * 30 * Math.sin((i + 1) * 0.4))}px`
                  }}
                ></div>
              ))}
            </div>
          </div>
          <div className="status-text">Speaking...</div>
          
          {/* Send Answer Button */}
          <button
            onClick={() => {
              console.log('📤 MANUAL SEND: User clicked send button');
              processPendingAudio();
            }}
            style={{
              marginTop: '20px',
              padding: '10px 30px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ✅ Send Answer
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

export default PureVoiceListener;
