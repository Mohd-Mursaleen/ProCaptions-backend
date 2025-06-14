"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"

export default function VideoSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false, amount: 0.3 })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  }

  return (
    <section id="demo" className="relative py-24 bg-gradient-to-b from-[#030303] to-[#050510] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(50,50,100,0.1),transparent_70%)]" />

      <motion.div
        ref={ref}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="container mx-auto px-4 md:px-6"
      >
        <motion.div variants={itemVariants} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">See ProCaptions in Action</h2>
          <p className="text-white/40 max-w-2xl mx-auto">
            Watch how our AI-powered tool transforms ordinary images into stunning designs with just a few clicks.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/10 border border-white/10"
        >
          <div className="aspect-video bg-black/50 relative">
            {/* This would be replaced with an actual video in production */}
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/6iUkTiAAxG8?autoplay=1&controls=1&rel=0"
              allowFullScreen
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
} 