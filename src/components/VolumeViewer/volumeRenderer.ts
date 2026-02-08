import {
    RenderingEngine,
    Enums,
    volumeLoader,
    setVolumesForViewports,
    imageLoader,
    utilities as csUtilities,
    type Types,
} from '@cornerstonejs/core';
import {
    TrackballRotateTool,
    ZoomTool,
    PanTool,
    ToolGroupManager,
    Enums as ToolEnums,
} from '@cornerstonejs/tools';
import { TOOL_GROUP_ID, RENDERING_ENGINE_ID, VIEWPORT_ID } from './constants';
import type { DicomImage } from './types';

/**
 * Configuration for tool bindings including keyboard modifiers for touchpad support.
 */
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

/**
 * Creates a Cornerstone 3D volume viewport and attaches interaction tools.
 * @param element - The HTML element to render into
 * @param imageIds - Array of DICOM image IDs to load
 * @param selectedPreset - Volume rendering preset name
 * @returns The created RenderingEngine instance
 */
export async function createVolumeViewport(
    element: HTMLElement,
    imageIds: string[],
    selectedPreset: string
): Promise<RenderingEngine> {
    ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);

    const volumeId = `vol-${Date.now()}`;
    const renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);

    renderingEngine.enableElement({
        viewportId: VIEWPORT_ID,
        element: element as HTMLDivElement,
        type: Enums.ViewportType.VOLUME_3D,
    });

    setupToolGroup();

    const images = await Promise.all(imageIds.map(id => imageLoader.loadAndCacheImage(id))) as unknown as DicomImage[];
    const { sortedImages, zSpacing, volumeOrigin } = sortImages(imageIds, images);

    const image0 = sortedImages[0];
    const { rows, columns } = image0;

    const samplePixelData = image0.getPixelData();
    const PixelDataConstructor = samplePixelData.constructor as
        typeof Int16Array | typeof Uint16Array | typeof Float32Array | typeof Int8Array | typeof Uint8Array;

    const sliceSize = rows * columns;
    const scalarData = new PixelDataConstructor(sliceSize * sortedImages.length);

    sortedImages.forEach((img, i) => {
        scalarData.set(img.getPixelData(), i * sliceSize);
    });

    const spacing: Types.Point3 = [
        image0.columnPixelSpacing || 1,
        image0.rowPixelSpacing || 1,
        zSpacing
    ];

    const volume = volumeLoader.createLocalVolume(volumeId, {
        dimensions: [columns, rows, sortedImages.length],
        spacing,
        scalarData,
        direction: new Float32Array(image0.direction || [1, 0, 0, 0, 1, 0, 0, 0, 1]) as unknown as Types.Mat3,
        origin: volumeOrigin,
        metadata: {
            FrameOfReferenceUID: image0.frameOfReferenceUID || `FOR-${Date.now()}`,
            Modality: image0.modality || 'CT',
            Columns: columns,
            Rows: rows,
            SamplesPerPixel: 1,
            PixelSpacing: [image0.columnPixelSpacing || 1, image0.rowPixelSpacing || 1],
            ImageOrientationPatient: image0.direction?.slice(0, 6) || [1, 0, 0, 0, 1, 0],
            BitsAllocated: image0.bitsAllocated || 16,
            BitsStored: image0.bitsStored || 12,
            HighBit: image0.highBit || 11,
            PixelRepresentation: image0.pixelRepresentation || 0,
            PhotometricInterpretation: image0.photometricInterpretation || 'MONOCHROME2',
            voiLut: [],
            VOILUTFunction: 'LINEAR',
        },
    });

    volume.load();
    await setVolumesForViewports(renderingEngine, [{ volumeId }], [VIEWPORT_ID]);

    const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IVolumeViewport;

    viewport.setBlendMode(Enums.BlendModes.COMPOSITE);
    viewport.setProperties({
        preset: selectedPreset,
        interpolationType: Enums.InterpolationType.FAST_LINEAR,
    });

    if ('setSampleDistanceMultiplier' in viewport) {
        (viewport as Types.IVolumeViewport & { setSampleDistanceMultiplier: (v: number) => void }).setSampleDistanceMultiplier(0.5);
    }

    viewport.resetCamera();
    renderingEngine.render();

    return renderingEngine;
}

function setupToolGroup(): void {
    const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
    if (!toolGroup) return;

    toolGroup.addTool(TrackballRotateTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);

    toolGroup.setToolActive(TrackballRotateTool.toolName, { bindings: TOOL_BINDINGS.rotate });
    toolGroup.setToolActive(PanTool.toolName, { bindings: TOOL_BINDINGS.pan });
    toolGroup.setToolActive(ZoomTool.toolName, { bindings: TOOL_BINDINGS.zoom });
}

function sortImages(imageIds: string[], images: DicomImage[]): {
    sortedImages: DicomImage[];
    zSpacing: number;
    volumeOrigin: Types.Point3;
} {
    try {
        const sortResult = csUtilities.sortImageIdsAndGetSpacing(imageIds);
        const imageMap = new Map(imageIds.map((id, i) => [id, images[i]]));
        return {
            sortedImages: sortResult.sortedImageIds.map(id => imageMap.get(id)!),
            zSpacing: sortResult.zSpacing,
            volumeOrigin: sortResult.origin as Types.Point3,
        };
    } catch {
        const image0 = images[0];
        return {
            sortedImages: images,
            zSpacing: image0.sliceThickness || 1.0,
            volumeOrigin: image0.origin || [0, 0, 0],
        };
    }
}

/**
 * Updates viewport properties when preset changes.
 */
export function updateViewportPreset(
    renderingEngine: RenderingEngine | null,
    selectedPreset: string
): void {
    if (!renderingEngine) return;

    const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IVolumeViewport | undefined;
    if (!viewport) return;

    viewport.setBlendMode(Enums.BlendModes.COMPOSITE);
    viewport.setProperties({
        preset: selectedPreset,
        interpolationType: Enums.InterpolationType.NEAREST,
    });
    viewport.render();
}
