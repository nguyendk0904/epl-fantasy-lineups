import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PlayerStatusBadge,
  getPlayerStatusConfig,
} from '../PlayerStatusBadge';

describe('PlayerStatusBadge Component Unit Tests', () => {
  describe('getPlayerStatusConfig Helper', () => {
    it('returns null for available or empty status', () => {
      expect(getPlayerStatusConfig('a')).toBeNull();
      expect(getPlayerStatusConfig(null)).toBeNull();
      expect(getPlayerStatusConfig(undefined)).toBeNull();
      expect(getPlayerStatusConfig('')).toBeNull();
    });

    it('returns correct config for injured status (i)', () => {
      const config = getPlayerStatusConfig('i', 'Hamstring injury - Expected return 30 Nov');
      expect(config).not.toBeNull();
      expect(config?.type).toBe('injured');
      expect(config?.icon).toBe('🚑');
      expect(config?.shortLabel).toBe('Injured');
      expect(config?.description).toBe('Hamstring injury - Expected return 30 Nov');
    });

    it('returns correct config for doubtful status (d) with and without chance', () => {
      const configWithChance = getPlayerStatusConfig('d', 'Ankle issue', 75);
      expect(configWithChance?.type).toBe('doubtful');
      expect(configWithChance?.icon).toBe('⚠️');
      expect(configWithChance?.shortLabel).toBe('75%');
      expect(configWithChance?.description).toBe('Ankle issue');

      const configWithoutChance = getPlayerStatusConfig('d', null, null);
      expect(configWithoutChance?.shortLabel).toBe('Doubtful');
      expect(configWithoutChance?.description).toContain('nghi ngờ khả năng ra sân');
    });

    it('returns correct config for suspended status (s)', () => {
      const config = getPlayerStatusConfig('s', 'Red card suspension');
      expect(config?.type).toBe('suspended');
      expect(config?.icon).toBe('🟥');
      expect(config?.shortLabel).toBe('Suspended');
      expect(config?.description).toBe('Red card suspension');
    });

    it('returns correct config for unavailable status (u/n)', () => {
      const configU = getPlayerStatusConfig('u');
      expect(configU?.type).toBe('unavailable');
      expect(configU?.icon).toBe('❌');
      expect(configU?.shortLabel).toBe('Out');

      const configN = getPlayerStatusConfig('n');
      expect(configN?.type).toBe('unavailable');
    });
  });

  describe('Component Rendering', () => {
    it('renders nothing when player status is available (a)', () => {
      const html = renderToStaticMarkup(<PlayerStatusBadge status="a" />);
      expect(html).toBe('');
    });

    it('renders nothing when player status is null or undefined', () => {
      const htmlNull = renderToStaticMarkup(<PlayerStatusBadge status={null} />);
      expect(htmlNull).toBe('');

      const htmlUndef = renderToStaticMarkup(<PlayerStatusBadge />);
      expect(htmlUndef).toBe('');
    });

    it('renders injured badge with red/hotpink style and ambulance icon', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge status="i" news="ACL injury" />
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('🚑');
      expect(html).toContain('Injured');
      expect(html).toContain('ACL injury');
      expect(html).toContain('bg-brand-hotpink');
    });

    it('renders doubtful badge with amber style and warning icon', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge status="d" chance={50} news="Illness - 50% chance" />
      );
      expect(html).toContain('⚠️');
      expect(html).toContain('50%');
      expect(html).toContain('Illness - 50% chance');
      expect(html).toContain('bg-amber-500');
    });

    it('renders suspended badge with red card icon', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge status="s" news="Suspended 1 match" />
      );
      expect(html).toContain('🟥');
      expect(html).toContain('Suspended');
      expect(html).toContain('Suspended 1 match');
    });

    it('renders pin variant for pitch slot overlay', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge status="i" variant="pin" />
      );
      expect(html).toContain('rounded-full');
      expect(html).toContain('🚑');
    });

    it('renders dot variant with pulsing animation', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge status="d" variant="dot" />
      );
      expect(html).toContain('animate-ping');
    });

    it('supports hiding label in badge variant', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge status="i" showLabel={false} />
      );
      expect(html).toContain('🚑');
      expect(html).not.toContain('<span>Injured</span>');
    });

    it('renders sizes sm, md, and lg properly', () => {
      const htmlSm = renderToStaticMarkup(
        <PlayerStatusBadge status="i" size="sm" />
      );
      expect(htmlSm).toContain('text-[10px]');

      const htmlMd = renderToStaticMarkup(
        <PlayerStatusBadge status="i" size="md" />
      );
      expect(htmlMd).toContain('text-xs');

      const htmlLg = renderToStaticMarkup(
        <PlayerStatusBadge status="i" size="lg" />
      );
      expect(htmlLg).toContain('text-sm');
    });

    it('includes accessibility attributes', () => {
      const html = renderToStaticMarkup(
        <PlayerStatusBadge
          status="i"
          news="Hamstring strain"
        />
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('role="tooltip"');
      expect(html).toContain('title="Chấn thương (0%) - Hamstring strain"');
      expect(html).toContain('aria-label="Chấn thương (0%): Hamstring strain"');
    });
  });
});
