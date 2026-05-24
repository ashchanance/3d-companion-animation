import { motion } from 'framer-motion';
import { Bot, Cpu, Gamepad2, Globe, MessageSquare, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';

const fadeIn: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const stagger: any = {
    visible: { transition: { staggerChildren: 0.1 } }
};

const GITHUB_URL = 'https://github.com/faxxxan/KIRA-AI-Companion.git';
const X_URL = 'https://x.com/mynamekiraa';

export default function Landing() {
    return (
        <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#efeded' }}>
            {/* Navigation */}
            <nav className="fixed w-full z-50 glass transition-all duration-300 border-b-0 shadow-sm top-0">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-serif text-2xl font-bold tracking-tight text-primary-950">KIRA</span>
                        <span className="text-sm font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">キラ</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-base font-medium text-slate-600">
                        <a href="#features" className="hover:text-primary-600 transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-primary-600 transition-colors">Demo</a>
                        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-primary-600 transition-colors">Documentation</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href={X_URL}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="LUMI on X"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 transition-all"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                <path d="M18.901 1.153h3.68l-8.037 9.188L24 22.847h-7.406l-5.8-7.584-6.637 7.584H.478l8.596-9.825L0 1.153h7.594l5.243 6.932 6.064-6.932Zm-1.29 19.494h2.04L6.486 3.24H4.298l13.313 17.407Z" />
                            </svg>
                        </a>

                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="LUMI on GitHub"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 transition-all"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                        </a>

                        <Link to="/chat" className="hidden md:inline-flex items-center justify-center rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 hover:shadow-lg hover:-translate-y-0.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                            Start Chat
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 overflow-hidden" style={{ backgroundColor: '#9d9d9d' }}>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 top-20 lg:top-0">
                    <div className="absolute inset-y-0 left-[58%] w-[120vw] -translate-x-1/2 lg:left-[64%] lg:w-[110vw]">
                        <video
                            src="/M3.mp4"
                            className="h-full w-full object-contain object-[65%_center] opacity-95"
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    </div>
                </div>

                <main className="relative z-10 pt-32 pb-8 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-12 items-start">
                    <motion.div
                        initial="hidden" animate="visible" variants={stagger}
                        className="flex flex-col items-start text-left lg:pr-8"
                    >
                        <motion.h1 variants={fadeIn} className="font-serif text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-6">
                            Kira
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400 italic font-normal">Energetic Star</span>
                        </motion.h1>

                        <motion.p variants={fadeIn} className="text-lg text-slate-600 mb-8 max-w-xl leading-relaxed">
                            Meet your personal AI companion always present, always listening. Choose your character, share your world, and never feel alone again. Self-hosted. Private. Yours.
                        </motion.p>

                        <motion.div variants={fadeIn} className="flex flex-wrap gap-4">
                            <Link to="/chat" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-1 transition-all">
                                Try It Now
                            </Link>
                            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full bg-white border border-slate-200 px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-1 transition-all">
                                View on GitHub
                            </a>
                        </motion.div>
                    </motion.div>

                    {/* 3D Avatar Render */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative z-0 w-full h-full min-h-[360px] lg:min-h-[560px] flex items-start justify-center -mt-8 lg:-mt-20"
                    >
                        <div className="w-full max-w-[760px] lg:max-w-[860px] aspect-[16/9] rounded-[2rem] bg-transparent" />
                    </motion.div>
                </main>
            </section>

            {/* Dialogue Section */}
            <section className="relative z-10 border-y border-slate-200/60 bg-white/50 backdrop-blur-sm py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto">
                        <p className="font-serif text-3xl md:text-4xl text-slate-900 mb-6 leading-relaxed">
                            Hey hey hey! You're finally here!
                        </p>
                        <p className="text-lg md:text-xl text-slate-700 mb-4">
                            You came. I knew you would be here.
                        </p>
                        <p className="text-lg md:text-xl text-slate-700">
                            There's no need to rush. We can chat slowly.
                        </p>
                    </div>
                </div>
            </section>

            {/* Upcoming Characters Section */}
            <section className="relative z-10 py-24 bg-slate-50 border-y border-slate-200/60 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[40%] bg-pink-100 rounded-full blur-[100px] opacity-50 mix-blend-multiply pointer-events-none"></div>
                <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[40%] bg-purple-100 rounded-full blur-[100px] opacity-40 mix-blend-multiply pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-16 relative z-10">
                        <div className="inline-flex items-center rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-sm font-medium text-pink-600 mb-4">
                            <span>Coming Soon</span>
                        </div>
                        <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
                            Meet The New <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 italic font-normal">Idols</span>
                        </h2>
                        <p className="text-slate-600 text-lg">
                            We are expanding our roster. Prepare to interact with new vibrant personalities, each with their own unique style and voice.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                        {/* Lumi */}
                        <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { delay: 0.1 } } }}
                            className="group relative rounded-3xl overflow-hidden bg-white hover:shadow-2xl hover:shadow-pink-500/10 transition-all duration-500 border border-slate-100"
                        >
                            <div className="aspect-[4/5] overflow-hidden bg-slate-100 relative">
                                <video
                                    src="/M4.mp4"
                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-80"></div>
                                <div className="absolute bottom-0 left-0 w-full p-6 text-left">
                                    <h3 className="font-serif text-3xl font-bold text-white mb-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">Lumi</h3>
                                    <p className="text-pink-200 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">The Energetic Star</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Nova */}
                         <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { delay: 0.2 } } }}
                            className="group relative rounded-3xl overflow-hidden bg-white hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 border border-slate-100 md:-translate-y-8"
                        >
                            <div className="aspect-[4/5] overflow-hidden bg-slate-100 relative">
                                <video
                                    src="/M2.mp4"
                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-80"></div>
                                <div className="absolute bottom-0 left-0 w-full p-6 text-left">
                                    <h3 className="font-serif text-3xl font-bold text-white mb-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">Nova</h3>
                                    <p className="text-purple-200 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">The Mysterious Observer</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Airi */}
                         <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { delay: 0.3 } } }}
                            className="group relative rounded-3xl overflow-hidden bg-white hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-500 border border-slate-100"
                        >
                            <div className="aspect-[4/5] overflow-hidden bg-slate-100 relative">
                                <video
                                    src="/M1.mp4"
                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-80"></div>
                                <div className="absolute bottom-0 left-0 w-full p-6 text-left">
                                    <h3 className="font-serif text-3xl font-bold text-white mb-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">Airi</h3>
                                    <p className="text-sky-200 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">The Elegant Companion</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="relative z-10 py-24 lg:py-32 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">Complete AI Capabilities</h2>
                        <p className="text-slate-600 text-lg">Everything you need to create your perfect digital companion, wrapped in an elegant interface.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: Mic, title: 'Realtime Voice Chat', desc: 'Natural conversational AI with advanced speech recognition and synthesis.' },
                            { icon: Gamepad2, title: 'Plays Video Games', desc: 'Capable of playing your favorite games like Minecraft & Factorio autonomously.' },
                            { icon: Cpu, title: 'Local AI / WebGPU', desc: 'Run models locally with WebGPU acceleration. Complete privacy, no cloud required.' },
                            { icon: Bot, title: 'Live2D & VRM Support', desc: 'Bring your favorite characters to life with full 3D avatar support and fluid animations.' },
                            { icon: Globe, title: '20+ LLM Providers', desc: 'Choose from OpenAI, Claude, DeepSeek, and more for maximum adaptability.' },
                            { icon: MessageSquare, title: 'Cross Platform', desc: 'Access your AI companion anywhere with full PWA and native application support.' },
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: i * 0.1 } } }}
                                className="group relative bg-white border border-slate-200 rounded-3xl p-8 hover:shadow-2xl hover:shadow-primary-600/5 hover:border-primary-100 transition-all duration-300"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300">
                                    <feature.icon size={24} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 bg-slate-900 text-white py-12 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="font-serif text-2xl font-bold tracking-tight text-white">Kira</span>
                        <span className="text-sm font-medium text-slate-400">© 2024</span>
                    </div>
                    <div className="flex gap-8 text-sm text-slate-400">
                        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
                        <a href={X_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">X</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
