"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote:
      "ProCaptions has revolutionized the way I create content for social media. The AI-powered segmentation is incredibly accurate, and the text customization options are endless!",
    author: "Jane D.",
    role: "Social Media Manager",
    avatar: "J",
  },
  {
    quote:
      "As a graphic designer, ProCaptions saves me hours of work. The ability to add multiple text layers with different styles is a game-changer.",
    author: "Mark T.",
    role: "Graphic Designer",
    avatar: "M",
  },
  {
    quote:
      "The real-time preview feature is fantastic. I can see exactly how my final image will look before exporting, which is a huge time-saver.",
    author: "Emily R.",
    role: "Content Creator",
    avatar: "E",
  },
]

export default function TestimonialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false, amount: 0.2 })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
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
    <section id="testimonials" className="relative py-24 bg-gradient-to-b from-[#050510] to-[#030303] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(100,50,255,0.08),transparent_70%)]" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold mb-4 text-white"
          >
            What Our Users Say
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/40 max-w-2xl mx-auto"
          >
            Hear from professionals who have transformed their workflow with ProCaptions
          </motion.p>
        </div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-8 relative"
            >
              <Quote className="absolute top-6 right-6 h-10 w-10 text-indigo-500/20" />
              <p className="text-white/70 mb-6 relative z-10">"{testimonial.quote}"</p>
              <div className="flex items-center">
                <div className="h-12 w-12 mr-4 rounded-full bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center text-white font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="text-white font-medium">{testimonial.author}</h4>
                  <p className="text-white/40 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
} 