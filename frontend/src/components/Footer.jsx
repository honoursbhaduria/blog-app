export default function Footer() {
    return (
        <footer className="bg-canvas-light brutal-border border-l-0 border-r-0 border-b-0 border-t-2 mt-20 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                <h2 className="text-4xl sm:text-7xl font-display font-black tracking-tighter uppercase mb-6 text-canvas-dark text-center">
                    THE CANVAS
                </h2>
                <div className="flex space-x-6 text-sm font-bold uppercase tracking-widest text-canvas-dark mb-8">
                    <a href="#" className="hover:text-canvas-coral transition-colors">About</a>
                    <a href="#" className="hover:text-canvas-coral transition-colors">Contact</a>
                    <a href="#" className="hover:text-canvas-coral transition-colors">Subscribe</a>
                </div>
                <p className="text-xs uppercase tracking-widest font-semibold text-gray-400">
                    &copy; {new Date().getFullYear()} The Canvas. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
}
