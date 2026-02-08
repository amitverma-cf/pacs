import type { Types } from '@cornerstonejs/core';
import type * as cornerstone from '@cornerstonejs/core';
import type dicomParser from 'dicom-parser';

/**
 * DICOM image loader utilities interface.
 */
export interface DICOMLoaderUtils {
    default?: DICOMLoaderUtils;
    external?: {
        cornerstone: typeof cornerstone;
        dicomParser: typeof dicomParser;
    };
    init?: (config: Record<string, unknown>) => void;
    wadouri?: {
        loadImage: Types.ImageLoaderFn;
    };
}

/**
 * Represents a loaded DICOM image with pixel data and metadata.
 */
export interface DicomImage {
    rows: number;
    columns: number;
    columnPixelSpacing?: number;
    rowPixelSpacing?: number;
    sliceThickness?: number;
    origin?: Types.Point3;
    direction?: number[];
    frameOfReferenceUID?: string;
    rescaleSlope?: number;
    rescaleIntercept?: number;
    modality?: string;
    photometricInterpretation?: string;
    bitsAllocated?: number;
    bitsStored?: number;
    highBit?: number;
    pixelRepresentation?: number;
    windowCenter?: number;
    windowWidth?: number;
    getPixelData: () => Int16Array | Uint16Array | Float32Array | Int8Array | Uint8Array;
}

/**
 * Pixel data typed array types supported by DICOM.
 */
export type PixelDataTypedArray = Int16Array | Uint16Array | Float32Array | Int8Array | Uint8Array;
