import { Router, Request, Response } from 'express';
import { atlasClient } from './atlas-client.js';
import { getProfiles, updateCustomProfile } from './connection-profiles.js';
import { getSocketHandler } from './socket-handler.js';
import type { ConnectionSettings } from './types.js';

export const router = Router();

/**
 * GET /api/cluster/status
 * Get current cluster status from Atlas API
 */
router.get('/cluster/status', async (_req: Request, res: Response) => {
  try {
    const status = await atlasClient.getClusterStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting cluster status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/profiles
 * Get all connection profiles
 */
router.get('/profiles', (_req: Request, res: Response) => {
  try {
    const profiles = getProfiles();
    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/profiles/custom
 * Update custom profile settings
 */
router.put('/profiles/custom', (req: Request, res: Response) => {
  try {
    const settings: ConnectionSettings = req.body;

    // Validate settings
    if (settings.serverSelectionTimeoutMS !== null &&
        settings.serverSelectionTimeoutMS !== undefined &&
        (typeof settings.serverSelectionTimeoutMS !== 'number' || settings.serverSelectionTimeoutMS < 0)) {
      res.status(400).json({
        success: false,
        error: 'serverSelectionTimeoutMS must be a positive number or null',
      });
      return;
    }

    if (settings.socketTimeoutMS !== null &&
        settings.socketTimeoutMS !== undefined &&
        (typeof settings.socketTimeoutMS !== 'number' || settings.socketTimeoutMS < 0)) {
      res.status(400).json({
        success: false,
        error: 'socketTimeoutMS must be a positive number or null',
      });
      return;
    }

    updateCustomProfile(settings);
    const profiles = getProfiles();
    const customProfile = profiles.find(p => p.name === 'custom');

    res.json({
      success: true,
      data: customProfile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/status
 * Get current test status
 */
router.get('/test/status', (_req: Request, res: Response) => {
  try {
    const handler = getSocketHandler();
    if (!handler) {
      res.json({
        success: true,
        data: { status: 'IDLE' },
      });
      return;
    }

    const state = handler.getTestState();
    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});
