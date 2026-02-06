import React, { useEffect, useRef, useState } from 'react';

import * as cornerstone from '@cornerstonejs/core';
import {
  init as coreInit,
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  imageLoader,
  metaData,
  type Types,
} from '@cornerstonejs/core';

import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';
import { cornerstoneStreamingImageVolumeLoader } from '@cornerstonejs/streaming-image-volume-loader';

import {
  TrackballRotateTool,
  ZoomTool,
  PanTool,
  ToolGroupManager,
  addTool,
  init as toolsInit,
  Enums as ToolEnums,
} from '@cornerstonejs/tools';

/** ToolGroup used to attach interaction tools to the 3D viewport. */
const TOOL_GROUP_ID = 'FINAL_STABLE_GROUP';
const RENDERING_ENGINE_ID = 'engine';
const VIEWPORT_ID = '3D_VIEWPORT';
let isInitialized = false;

/**
 * One-time Cornerstone initialization.
 * - Initializes Cornerstone Core + Tools v4
 * - Wires the DICOM image loader (wadouri)
 * - Registers the streaming volume loader
 */
const initCornerstone = async () => {
  if (isInitialized) return;
  isInitialized = true;
  await coreInit();

  // Required in Tools v4 to hook up enabled-element event listeners.
  toolsInit();

  const loaderUtils = (cornerstoneDICOMImageLoader as any).default || cornerstoneDICOMImageLoader;
  if (loaderUtils.external) {
    loaderUtils.external.cornerstone = cornerstone;
    loaderUtils.external.dicomParser = dicomParser;
  }
  if (loaderUtils.init) {
    await loaderUtils.init({});
  }
  if (loaderUtils.wadouri) {
    imageLoader.registerImageLoader('wadouri', loaderUtils.wadouri.loadImage);
  }
  volumeLoader.registerUnknownVolumeLoader(cornerstoneStreamingImageVolumeLoader as any);

  addTool(TrackballRotateTool);
  addTool(ZoomTool);
  addTool(PanTool);
};

export default function VolumeViewer() {
  const elementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const [status, setStatus] = useState('Idle');
  const presetOptions = cornerstone.CONSTANTS.VIEWPORT_PRESETS.map(preset => preset.name);
  const [selectedPreset, setSelectedPreset] = useState<string>(
    presetOptions.includes('CT-AAA') ? 'CT-AAA' : presetOptions[0] || 'CT-AAA'
  );

  useEffect(() => {
    initCornerstone().catch(console.error);
    return () => {
      if (renderingEngineRef.current) renderingEngineRef.current.destroy();
      ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
    };
  }, []);

  useEffect(() => {
    const renderingEngine = renderingEngineRef.current;
    if (!renderingEngine) return;

    const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IVolumeViewport | undefined;
    if (!viewport) return;

    viewport.setBlendMode(Enums.BlendModes.COMPOSITE);
    viewport.setProperties({ preset: selectedPreset });
    viewport.render();
  }, [selectedPreset]);

  /**
   * Loads a folder of DICOM slices from the user, sorts them, and renders a 3D volume.
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setStatus('Loading volume...');
    
    const fileObjects = Array.from(files).map(file => ({ 
      file, 
      num: parseInt(file.name.match(/\d+/)?.[0] || '0') 
    }));
    fileObjects.sort((a, b) => a.num - b.num);

    const objectUrls = fileObjects.map(obj => URL.createObjectURL(obj.file));
    const imageIds = objectUrls.map(url => `wadouri:${url}`);

    try {
      await renderVolume(imageIds);
      setStatus('Ready');
    } catch (e) {
      console.error(e);
      setStatus('Error');
    } finally {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    }
  };

  /**
   * Creates a Cornerstone 3D volume viewport and attaches interaction tools.
   * Controls:
   * - Left-drag: rotate (trackball)
   * - Middle-drag: pan
   * - Right-drag: zoom
   */
  const renderVolume = async (imageIds: string[]) => {
    if (!elementRef.current) return;

    if (renderingEngineRef.current) renderingEngineRef.current.destroy();
    ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);

    const volumeId = `vol-${Date.now()}`;

    const renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
    renderingEngineRef.current = renderingEngine;

    renderingEngine.enableElement({
      viewportId: VIEWPORT_ID,
      element: elementRef.current,
      type: Enums.ViewportType.VOLUME_3D,
    });

    const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
    if (toolGroup) {
      toolGroup.addTool(TrackballRotateTool.toolName);
      toolGroup.addTool(ZoomTool.toolName);
      toolGroup.addTool(PanTool.toolName);
      toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);

      toolGroup.setToolActive(TrackballRotateTool.toolName, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
      });
      toolGroup.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
      });
      toolGroup.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
      });
    }

    const images = await Promise.all(imageIds.map(id => imageLoader.loadAndCacheImage(id)));
    const image0 = images[0] as any;
    
    // Derive Z spacing from patient position when possible.
    let zSpacing = image0.sliceThickness || 1.0;
    if (imageIds.length > 1) {
      const p1 = metaData.get('imagePlaneModule', imageIds[0])?.imagePositionPatient;
      const p2 = metaData.get('imagePlaneModule', imageIds[1])?.imagePositionPatient;
      if (p1 && p2) {
        zSpacing = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2) + Math.pow(p2[2] - p1[2], 2));
      }
    }

    const spacing: Types.Point3 = [
      image0.columnPixelSpacing || 1, 
      image0.rowPixelSpacing || 1, 
      zSpacing
    ];

    const { rows, columns } = image0;
    const scalarData = new Float32Array(rows * columns * images.length);
    const sliceSize = rows * columns;
    images.forEach((img: any, i) => scalarData.set(img.getPixelData(), i * sliceSize));

    const volume = volumeLoader.createLocalVolume(volumeId, {
      dimensions: [columns, rows, images.length],
      spacing,
      scalarData,
      direction: new Float32Array(image0.direction || [1, 0, 0, 0, 1, 0, 0, 0, 1]) as unknown as Types.Mat3,
      origin: image0.origin || [0, 0, 0],
      metadata: {
        FrameOfReferenceUID: image0.frameOfReferenceUID || 'FOR-' + Date.now(),
        RescaleSlope: image0.rescaleSlope ?? 1,
        RescaleIntercept: image0.rescaleIntercept ?? -1024,
        Modality: 'CT',
      } as any
    });

    volume.load();
    await setVolumesForViewports(renderingEngine, [{ volumeId }], [VIEWPORT_ID]);
    
    const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IVolumeViewport;

    // Volume rendering in Cornerstone3D is GPU ray-casting. COMPOSITE is the
    // standard “ray traced” look (accumulating opacity/color along the ray).
    viewport.setBlendMode(Enums.BlendModes.COMPOSITE);

    // Apply a built-in transfer function + lighting preset for a more
    // realistic shaded 3D appearance.
    viewport.setProperties({ preset: selectedPreset });

    viewport.resetCamera();
    renderingEngine.render();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 12, background: '#111', color: '#fff', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center' }}>
        <label style={{ padding: '8px 16px', background: '#007bff', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
          UPLOAD DICOM FOLDER
          {/* @ts-expect-error Non-standard attribute for folder upload */}
          <input type="file" multiple webkitdirectory="true" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>

        <label style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#ddd' }}>
          Preset
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            style={{
              background: '#1b1b1b',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '8px 10px',
            }}
          >
            {presetOptions.map((presetName) => (
              <option key={presetName} value={presetName}>
                {presetName}
              </option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: 20, color: '#aaa' }}>{status}</span>
      </div>
      
      <div 
        ref={elementRef} 
        style={{ 
          flex: 1, 
          background: '#000', 
          touchAction: 'none', 
          pointerEvents: 'auto',
          cursor: 'grab' 
        }} 
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  );
}