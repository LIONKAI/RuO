export function Logo({ size = 22 }: { size?: number }) {
    return (
        <span
            className="font-display leading-none font-extrabold tracking-tight text-neutral-900"
            style={{ fontSize: size }}
        >
            Ru<span className="text-ruo-600">O</span>
        </span>
    );
}
