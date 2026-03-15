import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center bg-canvas-light px-4 text-center">
            <h1 className="text-[6rem] md:text-[10rem] leading-none font-display font-black tracking-tighter text-canvas-dark mb-4">
                404
            </h1>
            <div className="brutal-border border-2 bg-white px-8 py-4 mb-8 inline-block shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                <h2 className="text-xl md:text-2xl font-display font-bold uppercase tracking-widest text-canvas-coral">
                    Page Not Found
                </h2>
            </div>
            <p className="text-gray-600 font-medium max-w-md mx-auto mb-10">
                The page you are looking for does not exist, has been moved, or is temporarily unavailable.
            </p>
            <Link
                to="/"
                className="inline-flex justify-center items-center py-4 px-8 border-2 border-canvas-dark text-sm font-bold rounded-full uppercase tracking-widest text-white bg-canvas-coral hover:bg-canvas-dark transition-all shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
                Return to Canvas
            </Link>
        </div>
    );
}
