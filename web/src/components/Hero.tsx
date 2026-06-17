interface HeroProps {
    title: string;
    subtitle: string;
    ctaText?: string;
    ctaLink?: string;
    backgroundImage?: string;
    backgroundColorClass?: string;
    ctaButtonClass?: string;
}

export default function Hero({
    title,
    subtitle,
    ctaText,
    ctaLink,
    backgroundImage,
    backgroundColorClass = "bg-gray-900",
    ctaButtonClass = "bg-blue-600 hover:bg-blue-700"
}: HeroProps) {
    return (
        <div className={`relative ${backgroundColorClass} overflow-hidden`}>
            {backgroundImage && (
                <div className="absolute inset-0">
                    <img
                        className="w-full h-full object-cover opacity-30"
                        src={backgroundImage}
                        alt="Hero background"
                    />
                    <div className={`absolute inset-0 ${backgroundColorClass} opacity-50`}></div>
                </div>
            )}
            <div className="relative max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {title}
                </h1>
                <p className="mt-6 text-xl text-gray-300 max-w-3xl">
                    {subtitle}
                </p>
                {ctaText && ctaLink && (
                    <div className="mt-10">
                        <a
                            href={ctaLink}
                            className={`inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white md:py-4 md:text-lg md:px-10 ${ctaButtonClass}`}
                        >
                            {ctaText}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
