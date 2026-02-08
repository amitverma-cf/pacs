import * as cornerstone from '@cornerstonejs/core';
import { init as coreInit, volumeLoader, imageLoader } from '@cornerstonejs/core';
import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';
import { cornerstoneStreamingImageVolumeLoader } from '@cornerstonejs/streaming-image-volume-loader';
import {
    TrackballRotateTool,
    ZoomTool,
    PanTool,
    addTool,
    init as toolsInit,
} from '@cornerstonejs/tools';
import type { DICOMLoaderUtils } from './types';

let isInitialized = false;

/**
 * One-time Cornerstone initialization.
 * Initializes Core, Tools, DICOM loader with web workers, and registers volume loader.
 */
export async function initCornerstone(): Promise<void> {
    if (isInitialized) return;
    isInitialized = true;

    await coreInit();
    toolsInit();

    const loaderUtils = ((cornerstoneDICOMImageLoader as unknown as DICOMLoaderUtils).default || cornerstoneDICOMImageLoader) as DICOMLoaderUtils;

    if (loaderUtils.external) {
        loaderUtils.external.cornerstone = cornerstone;
        loaderUtils.external.dicomParser = dicomParser;
    }

    if (loaderUtils.init) {
        loaderUtils.init({
            maxWebWorkers: navigator.hardwareConcurrency || 4,
            strict: false,
        });
    }

    if (loaderUtils.wadouri) {
        imageLoader.registerImageLoader('wadouri', loaderUtils.wadouri.loadImage);
    }

    volumeLoader.registerUnknownVolumeLoader(
        cornerstoneStreamingImageVolumeLoader as unknown as Parameters<typeof volumeLoader.registerUnknownVolumeLoader>[0]
    );

    addTool(TrackballRotateTool);
    addTool(ZoomTool);
    addTool(PanTool);
}
