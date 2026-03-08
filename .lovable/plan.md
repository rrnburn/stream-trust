

## Problem Analysis

The native player buttons still don't work. Looking at the documentation, I found the issue:

1. **Using string action instead of enum**: The plugin exports an `ActivityAction` enum that should be used instead of raw strings like `'android.intent.action.VIEW'`
2. **Missing platform check**: The intent launcher only works on Android - we should check platform before attempting to use it

## Solution

Update `src/lib/nativePlayer.ts` to:

1. Import and use `ActivityAction.VIEW` enum instead of the string `'android.intent.action.VIEW'`
2. Add platform safety check using `Capacitor.getPlatform() === 'android'`
3. Add better error logging to understand what's happening

### Code Changes

**`src/lib/nativePlayer.ts`**

```typescript
import { logger } from '@/lib/logger';
import { isNativePlatform } from '@/lib/platform';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export function isNativePlayerAvailable(): boolean {
  return isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function playInVlc(url: string, title?: string): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    toast.error('External players only work on Android');
    return;
  }
  
  logger.info('NativePlayer', `Opening VLC for: ${url.substring(0, 120)}`);
  try {
    const { IntentLauncher, ActivityAction } = await import('@capgo/capacitor-intent-launcher');
    
    const result = await IntentLauncher.startActivityAsync({
      action: ActivityAction.VIEW,  // Use enum instead of string
      data: url,
      type: 'video/*',
      packageName: 'org.videolan.vlc',
      extra: {
        title: title || 'Video',
      },
    });
    logger.info('NativePlayer', `VLC intent result: ${JSON.stringify(result)}`);
  } catch (e: any) {
    logger.error('NativePlayer', `VLC launch failed: ${e?.message} | ${JSON.stringify(e)}`);
    toast.error('Could not open VLC. Is it installed?');
  }
}

// Similar changes for playInMxPlayer and playInSystemChooser
```

Key fixes:
- Use `ActivityAction.VIEW` enum (correct API usage)
- Import `ActivityAction` alongside `IntentLauncher`
- Add Android platform check with clear error message
- Log the result to help debug
- Log full error object to understand failures

