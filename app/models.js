/**
 * models.js
 * Shared model definitions for transcription and classification.
 * Kept in a separate file so it can be imported by both the server
 * actions file ('use server') and the client page ('use client').
 */

export const TRANSCRIPTION_MODELS = {
    'deepinfra-whisper': {
        id: 'deepinfra-whisper',
        label: 'Whisper Large v3 (DeepInfra)',
        provider: 'deepinfra',
    },
    'insanely-fast-whisper': {
        id: 'insanely-fast-whisper',
        label: 'Insanely Fast Whisper (Replicate)',
        provider: 'replicate',
        replicateModel: 'turian/insanely-fast-whisper-with-video:4f41e90243af171da918f04da3e526b2c247065583ea9b757f2071f573965408',
    },
    'incredibly-fast-whisper': {
        id: 'incredibly-fast-whisper',
        label: 'Incredibly Fast Whisper (Replicate)',
        provider: 'replicate',
        replicateModel: 'vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c',
    },
};

export const CLASSIFICATION_MODELS = {
    // RECOMMENDED: The latest frontier-class model (Released Feb 2026)
    'gemini-3-flash': {
        id: 'gemini-3-flash',
        label: 'Gemini 3 Flash',
        vertexModel: 'gemini-3-flash-preview',
    },
    // STABLE: The current reliable 2.5 series (Valid until June 2026)
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        vertexModel: 'gemini-2.5-flash',
    },
    // ULTRA-LOW LATENCY: Optimized for speed
    'gemini-2.5-flash-lite': {
        id: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash-Lite (Low Latency)',
        vertexModel: 'gemini-2.5-flash-lite',
    },
    // REPLACEMENT FOR PRO: Latest reasoning model
    'gemini-3.1-pro': {
        id: 'gemini-3.1-pro',
        label: 'Gemini 3.1 Pro',
        vertexModel: 'gemini-3.1-pro-preview',
    },
};