"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveConnectionState,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "../context/DeepgramContextProvider";
import {
  MicrophoneEvents,
  MicrophoneState,
  useMicrophone,
} from "../context/MicrophoneContextProvider";

import { type LiveSchema } from "@deepgram/sdk";
import Visualizer from "./Visualizer";
const defaultOptions = {
  model: "nova-2",
  language: "it",
  interim_results: true,
  smart_format: true,
  filler_words: true,
  utterance_end_ms: 3000,
};
const App: () => JSX.Element = () => {
  const [caption, setCaption] = useState<string | undefined>(
    "Powered by Deepgram"
  );
  const [options, setOptions] = useState<LiveSchema>(
    typeof window !== "undefined"
      ? localStorage.getItem("options")
        ? JSON.parse(localStorage.getItem("options") as string)
        : defaultOptions
      : defaultOptions
  );
  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const {
    setupMicrophone,
    microphone,
    startMicrophone,
    microphoneState,
    stopMicrophone,
  } = useMicrophone();
  const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();

  useEffect(() => {
    setupMicrophone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready) {
      connectToDeepgram(options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState]);

  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;
    const onData = (e: BlobEvent) => {
      connection?.send(e.data);
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      console.log("thisCaption", thisCaption);
      if (thisCaption !== "") {
        console.log('thisCaption !== ""', thisCaption);
        setCaption(thisCaption);
      }

      if (isFinal && speechFinal) {
        clearTimeout(captionTimeout.current);
        captionTimeout.current = setTimeout(() => {
          setCaption(undefined);
          clearTimeout(captionTimeout.current);
        }, 3000);
      }
    };

    if (connectionState === LiveConnectionState.OPEN) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);

      startMicrophone();
    }

    return () => {
      // prettier-ignore
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      clearTimeout(captionTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  useEffect(() => {
    if (!connection) return;

    if (
      microphoneState !== MicrophoneState.Open &&
      connectionState === LiveConnectionState.OPEN
    ) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      clearInterval(keepAliveInterval.current);
    }

    return () => {
      clearInterval(keepAliveInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, connectionState]);

  return (
    <>
      <div className="flex h-full antialiased">
        <form className="flex flex-col w-1/4 h-full bg-gray-900 text-white z-10 overflow-y-auto">
          <textarea
            className="h-full p-4 text-sm bg-gray-800 text-white"
            value={JSON.stringify(options, null, 2)}
            onChange={(e) => {
              setOptions(JSON.parse(e.target.value));
            }}
          />
          <button
           className="bg-red-500 text-white p-4 w-full text-center"
            onClick={() => {
              localStorage.setItem("options", JSON.stringify(options));
              alert("Options updated");
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }}
          >
            Update Options
          </button>
        </form>
        <div className="flex flex-row h-full w-full overflow-x-hidden">
          <div className="flex flex-col flex-auto h-full">
            {/* height 100% minus 8rem */}
            <div className="relative w-full h-full">
              {microphone && <Visualizer microphone={microphone} />}
              <div className="absolute bottom-[8rem]  inset-x-0 max-w-4xl mx-auto text-center">
                {caption && <span className="bg-black/70 p-8">{caption}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
