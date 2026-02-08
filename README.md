# PACS Volume Viewer

A professional-grade 3D DICOM volume rendering application built with React, TypeScript, and Cornerstone3D. This implementation follows industry standards used in clinical PACS (Picture Archiving and Communication System) viewers like OHIF Viewer.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [File Structure](#file-structure)
- [Technical Implementation](#technical-implementation)
- [Vite Configuration](#vite-configuration)
- [Volume Rendering Constraints](#volume-rendering-constraints)
- [Industry Standards & OHIF Inspiration](#industry-standards--ohif-inspiration)
- [Presets](#presets)
- [Troubleshooting](#troubleshooting)

---

## Overview

This application provides GPU-accelerated 3D volume rendering of DICOM image stacks using the Cornerstone3D library (v4.x). It enables radiologists and medical imaging professionals to visualize CT, MRI, and other volumetric datasets in an interactive 3D environment.

### Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^19.2.0 | UI Framework |
| TypeScript | ~5.9.3 | Type Safety |
| Vite | ^7.2.4 | Build Tool |
| Cornerstone3D Core | ^4.15.27 | Volume Rendering Engine |
| Cornerstone3D Tools | ^4.15.27 | Interaction Tools |
| @cornerstonejs/dicom-image-loader | ^4.15.27 | DICOM Parsing |
| @cornerstonejs/streaming-image-volume-loader | ^1.86.1 | Volume Streaming |
| dicom-parser | ^1.8.21 | DICOM Data Parsing |

---

## Features

- **3D Volume Rendering**: GPU-accelerated ray-casting with transfer function presets
- **DICOM Sorting**: Industry-standard sorting by `ImagePositionPatient` metadata
- **Multi-threaded Decoding**: Web Worker-based DICOM decompression
- **Dynamic Pixel Type Detection**: Automatic Int16/Uint16/Float32 selection for memory efficiency
- **Interactive Controls**: Trackball rotation, pan, zoom with mouse and keyboard shortcuts
- **Volume Presets**: All Cornerstone3D built-in presets (CT-AAA, CT-Bone, MR-Default, etc.)
- **Custom Cursors**: Green SVG cursors for visual feedback during interactions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VolumeViewer.tsx                        │
│                     (React Component Layer)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  initCornerstone │  │ volumeRenderer  │  │     cursors     │  │
│  │   (One-time init)│  │ (Volume logic)  │  │ (SVG cursors)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    constants.ts / types.ts                      │
│                   (Shared IDs and Interfaces)                   │
├─────────────────────────────────────────────────────────────────┤
│                      Cornerstone3D Library                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ @cs/core     │  │ @cs/tools    │  │ @cs/dicom-image-loader│  │
│  │ (Rendering)  │  │ (Interaction)│  │ (DICOM Parsing)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/amitverma-cf/pacs.git
cd pacs

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

---

## Usage

### Controls

| Action | Mouse | Keyboard Shortcut |
|--------|-------|-------------------|
| **Rotate** | Left-click + drag | - |
| **Pan** | Middle-click + drag | Shift + Left-click + drag |
| **Zoom** | Right-click + drag | Ctrl + Left-click + drag |

### Workflow

1. Click **"UPLOAD DICOM FOLDER"** button
2. Select a folder containing DICOM (.dcm) files
3. Wait for volume to load and render
4. Use the **Preset** dropdown to change transfer functions
5. Interact with the 3D volume using mouse/keyboard controls

---

## File Structure

```
src/components/VolumeViewer/
├── index.ts              # Barrel exports for clean imports
├── constants.ts          # Viewport and engine identifiers
├── cursors.ts            # SVG cursor definitions
├── types.ts              # TypeScript interfaces
├── initCornerstone.ts    # One-time library initialization
├── volumeRenderer.ts     # Volume creation and rendering logic
└── VolumeViewer.tsx      # Main React component
```

---

## Technical Implementation

### 1. `constants.ts` - Identifiers

```typescript
export const TOOL_GROUP_ID = 'VOLUME_VIEWER_TOOL_GROUP';
export const RENDERING_ENGINE_ID = 'VOLUME_VIEWER_ENGINE';
export const VIEWPORT_ID = 'VOLUME_3D_VIEWPORT';
```

**Purpose**: Cornerstone3D uses string identifiers to manage multiple viewports and tool groups. These constants ensure consistent references across the application.

---

### 2. `types.ts` - TypeScript Interfaces

#### `DICOMLoaderUtils`
Interface for the DICOM image loader module, handling the CommonJS/ESM module format differences:

```typescript
export interface DICOMLoaderUtils {
    default?: DICOMLoaderUtils;
    external?: { cornerstone, dicomParser };
    init?: (config: Record<string, unknown>) => void;
    wadouri?: { loadImage: Types.ImageLoaderFn };
}
```

#### `DicomImage`
Represents a loaded DICOM slice with pixel data and DICOM metadata:

```typescript
export interface DicomImage {
    rows: number;
    columns: number;
    columnPixelSpacing?: number;
    rowPixelSpacing?: number;
    sliceThickness?: number;
    // ... additional DICOM tags
    getPixelData: () => Int16Array | Uint16Array | Float32Array;
}
```

---

### 3. `cursors.ts` - SVG Cursor System

```typescript
const createSvgCursor = (svg: string, hotspotX = 12, hotspotY = 12) =>
    `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
```

**Cursor States**:
| State | Icon | Trigger |
|-------|------|---------|
| `default` | Green crosshair | Idle/hover |
| `rotate` | Rotation arrows | Left-click hold |
| `pan` / `panActive` | 4-way arrows | Shift+click or middle-click |
| `zoom` / `zoomActive` | Magnifying glass | Ctrl+click or right-click |

**Why SVG Cursors?**: 
- Native CSS cursors (`grab`, `move`) lack medical imaging context
- SVG allows custom colors (green for visibility on dark backgrounds)
- Inline data URIs avoid external file requests
- OHIF uses similar custom cursor approaches for specialized tools

---

### 4. `initCornerstone.ts` - Library Initialization

```typescript
export async function initCornerstone(): Promise<void> {
    if (isInitialized) return;
    isInitialized = true;

    await coreInit();
    toolsInit();
    // ... loader configuration
}
```

#### Key Initialization Steps:

1. **Core Initialization** (`coreInit()`): Sets up WebGL rendering context
2. **Tools Initialization** (`toolsInit()`): Registers event listeners for tool interactions
3. **DICOM Loader Configuration (v4 API)**:
   ```typescript
   loaderUtils.init({
       maxWebWorkers: navigator.hardwareConcurrency || 4,
       strict: false,
   });
   ```

**LoaderOptions Parameters (v4)**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `maxWebWorkers` | `number` | Number of Web Workers for parallel DICOM decoding |
| `strict` | `boolean` | If `false`, tolerates minor DICOM standard violations |
| `decodeConfig` | `LoaderDecodeOptions` | Optional decoder configuration |

---

### 5. `volumeRenderer.ts` - Core Rendering Logic

#### `createVolumeViewport()` - Main Function

```typescript
export async function createVolumeViewport(
    element: HTMLElement,
    imageIds: string[],
    selectedPreset: string
): Promise<RenderingEngine>
```

**Execution Flow**:

1. **Viewport Creation**:
   ```typescript
   renderingEngine.enableElement({
       viewportId: VIEWPORT_ID,
       element: element as HTMLDivElement,
       type: Enums.ViewportType.VOLUME_3D,
   });
   ```

2. **Tool Group Setup**:
   ```typescript
   const TOOL_BINDINGS = {
       rotate: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
       pan: [
           { mouseButton: ToolEnums.MouseBindings.Auxiliary },
           { mouseButton: ToolEnums.MouseBindings.Primary, modifierKey: ToolEnums.KeyboardBindings.Shift },
       ],
       zoom: [
           { mouseButton: ToolEnums.MouseBindings.Secondary },
           { mouseButton: ToolEnums.MouseBindings.Primary, modifierKey: ToolEnums.KeyboardBindings.Ctrl },
       ],
   };
   ```

   **Keyboard Modifier Support**: The Shift/Ctrl bindings enable touchpad users (laptops) to access pan/zoom without a 3-button mouse. This is an industry best practice also implemented in 3D Slicer and OHIF.

3. **Image Sorting (Industry Standard)**:
   ```typescript
   const sortResult = csUtilities.sortImageIdsAndGetSpacing(imageIds);
   sortedImageIds = sortResult.sortedImageIds;
   zSpacing = sortResult.zSpacing;
   volumeOrigin = sortResult.origin;
   ```

   **Why `sortImageIdsAndGetSpacing`?**:
   - Sorts by `ImagePositionPatient` DICOM tag (anatomical order)
   - Calculates Z-spacing from adjacent slice positions
   - Handles oblique acquisitions correctly
   - **NEVER sort by filename** - DICOM filenames are often UUIDs or random

4. **Automatic Pixel Type Detection**:
   ```typescript
   const samplePixelData = image0.getPixelData();
   const PixelDataConstructor = samplePixelData.constructor;
   const scalarData = new PixelDataConstructor(sliceSize * numSlices);
   ```

   **Memory Optimization**:
   | Modality | Typical Type | Bytes/Voxel | 500-slice CT (512×512) |
   |----------|--------------|-------------|------------------------|
   | CT | Int16Array | 2 | ~262 MB |
   | MR | Int16Array/Uint16Array | 2 | ~262 MB |
   | PET | Float32Array | 4 | ~524 MB |

   **Why not always Float32?**: Using the source data type saves 50% memory for integer modalities.

5. **Volume Metadata**:
   ```typescript
   metadata: {
       FrameOfReferenceUID, Modality, Columns, Rows,
       SamplesPerPixel, PixelSpacing, ImageOrientationPatient,
       BitsAllocated, BitsStored, HighBit, PixelRepresentation,
       PhotometricInterpretation, voiLut, VOILUTFunction
   }
   ```

   This matches Cornerstone3D's required `Metadata` interface for proper volume rendering.

6. **Rendering Configuration**:
   ```typescript
   viewport.setBlendMode(Enums.BlendModes.COMPOSITE);
   viewport.setProperties({
       preset: selectedPreset,
       interpolationType: Enums.InterpolationType.FAST_LINEAR,
   });
   viewport.setSampleDistanceMultiplier(0.5);
   ```

   - `COMPOSITE`: Standard ray-casting blend mode (accumulates opacity/color)
   - `FAST_LINEAR`: Trilinear interpolation for smooth voxel sampling
   - `sampleDistanceMultiplier: 0.5`: Higher quality (more samples per ray)

#### `sortImages()` - DICOM Sorting

```typescript
function sortImages(imageIds: string[], images: DicomImage[]): {
    sortedImages: DicomImage[];
    zSpacing: number;
    volumeOrigin: Types.Point3;
}
```

Uses Cornerstone's `sortImageIdsAndGetSpacing` utility which:
1. Extracts `ImagePositionPatient` from each image's metadata
2. Computes the scan axis normal from `ImageOrientationPatient`
3. Projects each position onto the scan axis
4. Sorts by projection distance
5. Calculates inter-slice spacing

**Fallback**: If metadata is missing, falls back to original order with `sliceThickness`.

---

### 6. `VolumeViewer.tsx` - React Component

```typescript
export default function VolumeViewer() {
    const elementRef = useRef<HTMLDivElement>(null);
    const renderingEngineRef = useRef<RenderingEngine | null>(null);
    // ...
}
```

#### State Management:
- `status`: Loading state indicator ('Idle', 'Loading volume...', 'Ready', 'Error')
- `cursorStyle`: Current cursor SVG based on interaction state
- `selectedPreset`: Active volume rendering preset

#### Lifecycle:
1. **Mount**: `initCornerstone()` called once
2. **Preset Change**: `updateViewportPreset()` applies new transfer function
3. **Unmount**: Cleanup with `cache.purgeCache()` to free GPU memory

#### Memory Management:
```typescript
return () => {
    renderingEngineRef.current?.destroy();
    ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
    cache.purgeCache();
};
```

**Why `cache.purgeCache()`?**: Cornerstone caches decoded images in memory. Without explicit cleanup, switching between large datasets can cause memory exhaustion.

---

## Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
    plugins: [react(), viteCommonjs()],
    optimizeDeps: {
        exclude: ['@cornerstonejs/dicom-image-loader'],
        include: ['dicom-parser', '@cornerstonejs/core', '@cornerstonejs/tools'],
    },
    worker: {
        format: 'es',
    },
})
```

### Configuration Explained

#### `viteCommonjs()` Plugin
The DICOM image loader and some Cornerstone dependencies use CommonJS format. This plugin converts them for Vite's ESM-native bundler.

#### `optimizeDeps.exclude: ['@cornerstonejs/dicom-image-loader']`
**Critical**: The DICOM loader creates Web Workers dynamically. If Vite pre-bundles it, the worker paths break. Excluding it preserves the original module structure.

#### `optimizeDeps.include: [...]`
Pre-bundles these dependencies to avoid runtime transformation overhead. These are safe to bundle because they don't spawn workers.

#### `worker.format: 'es'`
Forces Web Workers to use ES module format, which is required for Vite's dev server to properly resolve imports within workers.

**Common Issues Without This Configuration**:
- `Module not found` errors for worker scripts
- `fs` and `path` externalization warnings (Node.js polyfills)
- Codec loading failures at runtime

---

## Volume Rendering Constraints

### 1. Missing Slices Problem

**Issue**: If slices are missing from a DICOM series, the volume will have gaps.

**Symptoms**:
- Black bands in the rendered volume
- Incorrect anatomical proportions
- Z-spacing calculation errors

**Current Handling**: 
- `sortImageIdsAndGetSpacing` calculates spacing from actual positions
- Missing slices result in larger-than-expected gaps
- No automatic resampling is performed

**Industry Solution (OHIF/3D Slicer)**:
- Detect non-uniform spacing
- Option to resample to uniform grid
- Display warning to user

### 2. Interpolation Artifacts

**Issue**: When slice thickness differs from in-plane resolution, interpolation can cause stair-stepping.

**Available Interpolation Modes**:
| Mode | Quality | Performance | Use Case |
|------|---------|-------------|----------|
| `NEAREST` | Low | Fast | Segmentation masks |
| `LINEAR` | Medium | Medium | General use |
| `FAST_LINEAR` | High | Medium | Volume rendering |

**Current Setting**: `FAST_LINEAR` for optimal quality/performance balance.

### 3. Memory Limits

**Browser Memory Constraints**:
- Chrome: ~4GB per tab (varies by OS)
- Firefox: ~2GB per tab
- Safari: More restrictive

**Typical Dataset Sizes**:
| Scan Type | Slices | Resolution | Memory (Int16) |
|-----------|--------|------------|----------------|
| CT Chest | 300 | 512×512 | ~157 MB |
| CT Abdomen | 800 | 512×512 | ~419 MB |
| MR Brain | 200 | 256×256 | ~26 MB |
| High-res CT | 1000 | 1024×1024 | ~2 GB |

**Mitigation**: Automatic pixel type detection uses Int16 instead of Float32 where possible, halving memory usage.

### 4. Orientation Requirements

**Required DICOM Tags**:
- `ImagePositionPatient` (0020,0032)
- `ImageOrientationPatient` (0020,0037)
- `PixelSpacing` (0028,0030)

**Fallback Behavior**: If orientation data is missing, the volume may render but with incorrect spatial orientation.

---

## Industry Standards & OHIF Inspiration

### Sorting Algorithm
This implementation uses `csUtilities.sortImageIdsAndGetSpacing()`, which is the same algorithm used in OHIF Viewer's volume loading pipeline. It projects slice positions onto the scan axis normal for proper anatomical ordering.

### Tool Bindings
The keyboard modifier bindings (Shift for pan, Ctrl for zoom) match 3D Slicer's interaction model, making the interface familiar to radiologists.

### Web Worker Architecture
The multi-threaded DICOM decoding matches OHIF's approach, using `navigator.hardwareConcurrency` to maximize CPU utilization.

### Transfer Function Presets
All presets come from Cornerstone3D's `VIEWPORT_PRESETS` constant, which includes clinically-validated transfer functions for CT, MR, PET, and other modalities.

---

## Presets

Available presets (from `cornerstone.CONSTANTS.VIEWPORT_PRESETS`):

| Preset | Description | Best For |
|--------|-------------|----------|
| CT-AAA | Abdominal Aortic Aneurysm | Vascular CT |
| CT-Bone | Bone visualization | Orthopedic CT |
| CT-Cardiac | Cardiac structures | Cardiac CT |
| CT-Chest-Contrast-Enhanced | Contrast studies | Chest CT |
| CT-Chest-Vessels | Pulmonary vessels | Chest CTA |
| CT-Coronary-Arteries | Coronary visualization | Cardiac CTA |
| CT-Fat | Fat tissue | Body composition |
| CT-Liver-Vasculature | Hepatic vessels | Liver CT |
| CT-Lung | Lung parenchyma | Chest CT |
| CT-MIP | Maximum Intensity Projection | Angiography |
| CT-Muscle | Muscle tissue | MSK studies |
| CT-Pulmonary-Arteries | Pulmonary arteries | PE studies |
| CT-Soft-Tissue | General soft tissue | General CT |
| MR-Default | Default MR settings | MRI |
| MR-MIP | MR angiography | MRA |
| MR-T2-Brain | T2 brain imaging | Neuro MRI |

---

## Troubleshooting

### "Module externalized for browser compatibility" Warning

**Cause**: Cornerstone codecs import Node.js modules (`fs`, `path`)

**Solution**: These are automatically externalized by Vite. The warning is informational only.

### Volume Appears Scrambled

**Cause**: Incorrect slice ordering

**Solution**: Ensure DICOM files have valid `ImagePositionPatient` tags. The current implementation falls back to filename sorting only if metadata is missing.

### Black Screen After Loading

**Cause**: Viewport not properly initialized or preset incompatible with modality

**Solution**: 
1. Check browser console for errors
2. Try a different preset
3. Ensure DICOM files are valid

### Out of Memory Errors

**Cause**: Dataset too large for browser memory

**Solution**:
1. Use a smaller dataset
2. Close other browser tabs
3. Use a 64-bit browser

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `npm run lint` before committing
4. Submit a pull request

---

## References

- [Cornerstone3D Documentation](https://www.cornerstonejs.org/)
- [OHIF Viewer](https://github.com/OHIF/Viewers)
- [DICOM Standard](https://www.dicomstandard.org/)
- [3D Slicer](https://www.slicer.org/)
