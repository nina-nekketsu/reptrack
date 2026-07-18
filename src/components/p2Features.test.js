import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { bestSet, getRecords } from '../utils/exerciseHelpers';
import {
  loadHapticsEnabled,
  loadSoundEnabled,
  saveHapticsEnabled,
  saveSoundEnabled,
  vibrate,
} from '../utils/timer';
import { buildWorkoutSummaryText } from './WorkoutSummary';
import Sheet from './Sheet';

describe('P2 workout experience contracts', () => {
  beforeEach(() => localStorage.clear());

  test('warm-up sets do not become PRs or ghost-record volume', () => {
    const sets = [
      { reps: 3, weight: 200, setType: 'warmup' },
      { reps: 8, weight: 100, setType: 'normal' },
    ];
    expect(bestSet(sets)).toEqual(sets[1]);
    expect(getRecords([{ sets, totalVolume: 1400 }])).toEqual({
      maxWeight: 100,
      maxReps: 8,
      maxVolume: 800,
    });
  });

  test('sound and haptic preferences persist and haptics are respected', () => {
    saveSoundEnabled(false);
    saveHapticsEnabled(false);
    expect(loadSoundEnabled()).toBe(false);
    expect(loadHapticsEnabled()).toBe(false);
    const vibrateSpy = jest.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrateSpy });
    vibrate([30, 60, 30]);
    expect(vibrateSpy).not.toHaveBeenCalled();
    saveHapticsEnabled(true);
    vibrate([30, 60, 30]);
    expect(vibrateSpy).toHaveBeenCalledWith([30, 60, 30]);
  });

  test('workout summary text contains honest portable metrics', () => {
    expect(buildWorkoutSummaryText({ exerciseCount: 4, totalSets: 12, totalVolume: 6400, duration: 3600000 }, 20))
      .toContain('4 exercises · 12 sets\n6,400 kg volume\n60 min\n20 min cardio');
  });

  test('Sheet provides dialog semantics, scroll lock and Escape dismissal', () => {
    const onClose = jest.fn();
    const { unmount } = render(<Sheet open onClose={onClose} title="Rest options"><button type="button">First option</button></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Rest options' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
