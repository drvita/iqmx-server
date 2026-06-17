interface InfoCardProps {
    title: string;
    description: string;
    backgroundColorClass?: string;
    titleClassName?: string;
    descriptionClassName?: string;
}

export default function InfoCard({
    title,
    description,
    backgroundColorClass = "bg-white",
    titleClassName = "text-xl font-semibold mb-2",
    descriptionClassName = "text-gray-600"
}: InfoCardProps) {
    return (
        <div className={`${backgroundColorClass} p-6 rounded-lg shadow-sm`}>
            <h3 className={titleClassName}>{title}</h3>
            <p className={descriptionClassName}>{description}</p>
        </div>
    );
}
