import React from 'react';

const Swatch = ({ title, description, background, foreground }) => {
    return (
        <div className="theme-surface rounded-2xl overflow-hidden">
            <div className="h-20" style={{ background }} />
            <div className="p-4 space-y-1">
                <div className="text-[13px] font-semibold" style={{ color: foreground || 'var(--color-text)' }}>
                    {title}
                </div>
                {description ? <div className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{description}</div> : null}
                <div className="mt-3 rounded-xl px-3 py-2" style={{ background, color: foreground || 'var(--color-text)' }}>
                    <div className="text-[12px] font-semibold">Aa</div>
                    <div className="text-[11px]" style={{ opacity: 0.85 }}>
                        The quick brown fox jumps over the lazy dog.
                    </div>
                </div>
            </div>
        </div>
    );
};

const ThemeUsageDemo = () => {
    return (
        <div className="theme-surface rounded-2xl p-6 space-y-4">
            <div className="space-y-1">
                <div className="text-[14px] font-semibold">Usage Demo</div>
                <div className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                    Buttons, cards, inputs, and tables.
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button className="theme-btn px-4 h-10 rounded-xl font-semibold text-[13px] transition-colors">
                    Primary Action
                </button>
                <button
                    className="px-4 h-10 rounded-xl font-semibold text-[13px] transition-colors"
                    style={{
                        background: 'var(--color-surface-2)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    Secondary
                </button>
                <a className="theme-link text-[13px] font-semibold underline underline-offset-4" href="#palette">
                    Link
                </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                        Card
                    </div>
                    <div className="mt-2 text-[14px] font-semibold">Card Title</div>
                    <div className="mt-1 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                        Supporting copy that stays readable with forced black text.
                    </div>
                </div>
                <div className="theme-ink rounded-2xl p-4">
                    <div className="text-[12px] font-semibold" style={{ opacity: 0.9 }}>
                        Accent Surface
                    </div>
                    <div className="mt-2 text-[14px] font-semibold">Emphasis block</div>
                    <div className="mt-1 text-[12px]" style={{ opacity: 0.9 }}>
                        Use for primary buttons and key highlights.
                    </div>
                </div>
            </div>
        </div>
    );
};

const ThemeFrame = ({ title, palette, children }) => {
    return (
        <div className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            <div
                className="px-4 h-12 flex items-center justify-between"
                style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    borderBottom: `1px solid var(--color-border)`,
                }}
            >
                <div className="text-[13px] font-semibold">{title}</div>
                <div className="text-[11px]" style={{ opacity: 0.8 }}>
                    {palette === 'before' ? 'Before' : 'After'}
                </div>
            </div>
            <div data-palette={palette === 'before' ? 'before' : undefined} className="p-5 space-y-6" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                {children}
            </div>
        </div>
    );
};

const StyleGuide = () => {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Color System</h1>
                    <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        New palette extracted from the reference: #ffffff, #dddddd, #cbcbcb, #a6a6a6, #818181. Text is forced to #000000.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ThemeFrame title="Before (Previous Palette)" palette="before">
                    <ThemeUsageDemo />

                    <div id="palette" className="space-y-3">
                        <div className="text-[14px] font-semibold">Palette</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Swatch title="Accent" description="#fdbcc7 (primary highlight)" background="#fdbcc7" foreground="#000000" />
                            <Swatch title="Secondary" description="#e5788b (hover/interactive)" background="#e5788b" foreground="#000000" />
                            <Swatch title="Ink" description="#4c3c3a (strong surface)" background="#4c3c3a" foreground="#000000" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[14px] font-semibold">Derived Roles</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Swatch title="Background" description="--color-bg" background="var(--color-bg)" />
                            <Swatch title="Surface" description="--color-surface" background="var(--color-surface)" />
                            <Swatch title="Surface 2" description="--color-surface-2" background="var(--color-surface-2)" />
                            <Swatch title="Border" description="--color-border" background="var(--color-border)" />
                        </div>
                    </div>
                </ThemeFrame>

                <ThemeFrame title="After (New Palette)" palette="after">
                    <ThemeUsageDemo />

                    <div className="space-y-3">
                        <div className="text-[14px] font-semibold">Palette</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Swatch title="White" description="#ffffff" background="#ffffff" foreground="#000000" />
                            <Swatch title="Light Gray" description="#dddddd" background="#dddddd" foreground="#000000" />
                            <Swatch title="Mid Gray" description="#cbcbcb" background="#cbcbcb" foreground="#000000" />
                            <Swatch title="Dark Gray" description="#a6a6a6" background="#a6a6a6" foreground="#000000" />
                            <Swatch title="Accent Gray" description="#818181" background="#818181" foreground="#000000" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[14px] font-semibold">Derived Roles</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Swatch title="Background" description="--color-bg" background="var(--color-bg)" />
                            <Swatch title="Surface" description="--color-surface" background="var(--color-surface)" />
                            <Swatch title="Surface 2" description="--color-surface-2" background="var(--color-surface-2)" />
                            <Swatch title="Border" description="--color-border" background="var(--color-border)" />
                        </div>
                    </div>
                </ThemeFrame>
            </div>
        </div>
    );
};

export default StyleGuide;
