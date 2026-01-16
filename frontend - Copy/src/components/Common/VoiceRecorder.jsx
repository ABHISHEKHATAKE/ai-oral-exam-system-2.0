import React, { useRef, useState, useEffect } from 'react';

export function VoiceRecorder({ onRecordingComplete, isRecording: parentIsRecording }) {
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const recordingIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      audioStreamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // or audio/wav depending on browser
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
          onRecordingComplete({
            audio: base64Audio,
            duration: recordingTime,
            timestamp: Date.now()
          });
        };
        reader.readAsDataURL(audioBlob);

        // Reset
        setRecordingTime(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      // Stop audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder card border-0 shadow-sm p-4 mb-3">
      <div className="d-flex align-items-center justify-content-between">
        <div className="flex-grow-1">
          <h6 className="mb-0 fw-bold">🎤 Voice Recording</h6>
          {isRecording && (
            <small className="text-danger d-block mt-2">
              <span className="badge bg-danger animate-pulse">● Recording</span> {formatTime(recordingTime)}
            </small>
          )}
        </div>

        <div className="btn-group" role="group">
          {!isRecording ? (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={startRecording}
              disabled={parentIsRecording}
            >
              🎤 Start Recording
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={stopRecording}
            >
              ⏹ Stop Recording
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse {
          animation: pulse 1s infinite;
        }
      `}</style>
    </div>
  );
}

export default VoiceRecorder;
