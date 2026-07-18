import { useEffect, useRef, useState } from "react";

const isExpectedCancellation = (error) => error?.name === "AbortError";

export default function OfficeCanvas({ world, visibleSceneId, onFrame, onDoorSelect, onActorSelect, onReady, onError }) {
  const [host, setHost] = useState(null);
  const rendererRef = useRef(null);
  const generationRef = useRef(0);
  const latestPropsRef = useRef(null);
  latestPropsRef.current = {
    world,
    visibleSceneId,
    onFrame,
    onDoorSelect,
    onActorSelect,
    onReady,
    onError,
  };

  useEffect(() => {
    if (!host) return undefined;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    let cancelled = false;

    const setup = async () => {
      try {
        const { applyOfficeRendererUpdate, createOfficeRenderer } = await import("./createOfficeRenderer.js");
        const renderer = await createOfficeRenderer({
          host,
          signal: controller.signal,
          shouldAttach: () => !cancelled && generationRef.current === generation,
          getCallbacks: () => latestPropsRef.current,
        });
        if (!renderer || cancelled || generationRef.current !== generation) {
          renderer?.destroy();
          return;
        }
        rendererRef.current = { generation, renderer, applyOfficeRendererUpdate };
        const ready = applyOfficeRendererUpdate(renderer, {
          world: latestPropsRef.current.world,
          visibleSceneId: latestPropsRef.current.visibleSceneId,
          onError: latestPropsRef.current.onError,
        });
        if (ready && !cancelled && generationRef.current === generation) {
          latestPropsRef.current.onReady?.(renderer);
        }
      } catch (error) {
        if (!cancelled && !isExpectedCancellation(error)) latestPropsRef.current.onError?.(error);
      }
    };

    void setup();
    return () => {
      cancelled = true;
      controller.abort();
      const current = rendererRef.current;
      if (current?.generation === generation) {
        rendererRef.current = null;
        current.renderer.destroy();
      }
    };
  }, [host]);

  useEffect(() => {
    const current = rendererRef.current;
    if (!current) return;
    current.applyOfficeRendererUpdate(current.renderer, {
      world,
      visibleSceneId,
      onError: latestPropsRef.current.onError,
    });
  }, [world, visibleSceneId]);

  return <div ref={setHost} className="office-canvas-host" aria-hidden="true" />;
}
