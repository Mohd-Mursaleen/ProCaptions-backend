"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Wand2, Layers, Palette, Zap, Eye, Download } from "lucide-react"

const features = [
  {
    icon: <Wand2 className="h-10 w-10" />,
    title: "AI-Powered Segmentation",
    description:
      "Our advanced AI automatically detects and isolates the main subject in your images with incredible precision.",
  },
  {
    icon: <Layers className="h-10 w-10" />,
    title: "Multiple Text Layers",
    description:
      "Add multiple text layers with different styles, fonts, and effects to create complex and professional designs.",
  },
  {
    icon: <Palette className="h-10 w-10" />,
    title: "Extensive Customization",
    description: "Customize every aspect of your text including font, size, color, shadow, and positioning.",
  },
  {
    icon: <Zap className="h-10 w-10" />,
    title: "Lightning Fast Processing",
    description:
      "Experience rapid image processing and text rendering, even with complex designs and high-resolution images.",
  },
  {
    icon: <Eye className="h-10 w-10" />,
    title: "Real-Time Preview",
    description:
      "See exactly how your final image will look before exporting, allowing for quick adjustments and iterations.",
  },
  {
    icon: <Download className="h-10 w-10" />,
    title: "High-Quality Export",
    description:
      "Export your designs in various formats and resolutions, perfect for social media, print, or digital marketing.",
  },
]

export default function FeaturesSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false, amount: 0.2 })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
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
    <section id="features" className="relative py-24 bg-[#050510] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,50,255,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,50,120,0.1),transparent_50%)]" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold mb-4 text-white"
          >
            Powerful Features
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/40 max-w-2xl mx-auto"
          >
            Discover the tools that make ProCaptions the ultimate choice for creating stunning image-text compositions
          </motion.p>
        </div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/[0.05] transition-colors duration-300 group"
            >
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-500/20 to-rose-500/20 flex items-center justify-center mb-6 text-indigo-300 group-hover:text-white transition-colors duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-indigo-300 transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-white/40 group-hover:text-white/60 transition-colors duration-300">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
} 