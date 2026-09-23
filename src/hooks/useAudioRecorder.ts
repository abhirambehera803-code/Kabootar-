import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioRecordResult {
  blob: Blob;
  durationSeconds: number;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    setWaveformLevels([]);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // Audio analyser for real-time waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder with audio/webm or audio/mp4 fallback
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else {
          options = { mimeType: '' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options.mimeType ? options : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      durationRef.current = 0;

      // Duration counter
      durationIntervalRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);

      // Waveform update loop
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 12 frequencies
        const samples: number[] = [];
        const step = Math.floor(dataArray.length / 12);
        for (let i = 0; i < 12; i++) {
          const val = dataArray[i * step] || 0;
          samples.push(Math.max(12, Math.min(100, Math.round((val / 255) * 100))));
        }
        setWaveformLevels(samples);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      return true;
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setError(err.message || 'Microphone access denied. Please allow microphone permissions in browser.');
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<AudioRecordResult | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }

      const finalDuration = durationRef.current;

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        cleanup();
        resolve({
          blob,
          durationSeconds: Math.max(1, finalDuration)
        });
      };

      mediaRecorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    audioChunksRef.current = [];
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isPaused,
    duration,
    waveformLevels,
    error,
    startRecording,
    stopRecording,
    cancelRecording
  };
}
