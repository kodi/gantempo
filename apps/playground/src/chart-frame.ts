import type { ScenarioTheme } from './scenarios';

export const chartFrameBaseClasses = 'overflow-hidden';

export const chartFrameElevatedClasses =
  'rounded-[15px] shadow-[0_1px_2px_rgb(38_48_42/4%),0_20px_55px_rgb(38_48_42/8%)]';

export const chartFrameThemeClasses: Readonly<Record<ScenarioTheme, string>> = Object.freeze({
  dark: 'border border-[#34423e] bg-[#18211f] text-[#edf3f0] [--playground-frame-border:#34423e] [--playground-frame-muted:#99a7a2]',
  'high-contrast':
    'border-2 border-[#111] bg-white text-black [--playground-frame-border:#111] [--playground-frame-muted:#111]',
  light:
    'border border-[#dfe4df] bg-[#fbfcfa] text-[#26352f] [--playground-frame-border:#dfe4df] [--playground-frame-muted:#69736c]',
});

export const chartFrameToolbarClasses =
  'flex items-center justify-between border-b border-[var(--playground-frame-border)] px-5 [&>div:first-child]:grid [&>div:first-child]:gap-[3px] [&_strong]:text-[13px] [&_span]:text-[10px] [&_span]:text-[var(--playground-frame-muted)]';

export const chartFrameActionsClasses =
  'flex gap-[5px] [&_button]:min-h-[29px] [&_button]:rounded-[7px] [&_button]:border [&_button]:border-[var(--playground-frame-border)] [&_button]:bg-transparent [&_button]:px-[9px] [&_button]:text-[10px] [&_button]:font-bold [&_button]:text-inherit [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-62';

export const narrowTimeHeaderClasses =
  "max-[561px]:[&_[data-gt-part='time-header']>span:nth-child(even)]:hidden";
