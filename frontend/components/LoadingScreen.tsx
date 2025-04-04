"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Layers, Edit, Play, ChevronRight } from "lucide-react"

interface LoadingScreenProps {
  title?: string;
  description?: string;
  fullScreen?: boolean;
  progress?: number;
  step?: number;
  totalSteps?: number;
  estimatedTime?: number; // in seconds
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = "Loading...",
  description = "Please wait while we process your request.",
  fullScreen = false,
  progress,
  step = 2,
  totalSteps = 3,
  estimatedTime
}) => {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentTip, setCurrentTip] = useState(0)

  const tips = [
    "Pro tip: You can add multiple text layers to create complex captions.",
    "Try different fonts to make your captions stand out.",
    "Use shadow effects to improve text visibility on any background.",
    "Position your text precisely to create the perfect composition."
  ]

  useEffect(() => {
    // Cycle through tips every 4 seconds
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length)
    }, 4000)

    // Track elapsed time
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => {
      clearInterval(tipInterval)
      clearInterval(timeInterval)
    }
  }, [tips.length])

  // Calculate progress if not provided but estimated time is
  const calculatedProgress =
    progress !== undefined ? progress : estimatedTime ? Math.min(100, (elapsedTime / estimatedTime) * 100) : undefined

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.15,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 },
    },
  }

  const stepIcons = [
    <Play key="upload" className="w-5 h-5" />,
    <Edit key="edit" className="w-5 h-5" />,
    <Layers key="preview" className="w-5 h-5" />
  ]

  const content = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center p-6 relative"
    >
      {/* Step indicator */}
      {totalSteps > 1 && (
        <motion.div variants={itemVariants} className="mb-8 w-full max-w-md">
          <div className="text-white/50 text-center mb-4">
            Step {step} of {totalSteps}
          </div>
          <div className="flex items-center justify-between relative">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <div className="flex-1 h-1 mx-1">
                    <div className={`h-full ${index < step ? "bg-indigo-500" : "bg-white/20"}`}></div>
                  </div>
                )}
                <div 
                  className={`rounded-full ${
                    index + 1 === step 
                      ? "bg-indigo-500" 
                      : index + 1 < step 
                        ? "bg-indigo-700" 
                        : "bg-white/10"
                  } w-10 h-10 flex items-center justify-center`}
                >
                  {index + 1 === step ? (
                    <motion.div
                      animate={{ scale: [0.9, 1.1, 0.9] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-white"
                    >
                      {stepIcons[index]}
                    </motion.div>
                  ) : (
                    <span className={`${index + 1 < step ? "text-white" : "text-white/50"}`}>
                      {stepIcons[index]}
                    </span>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      )}

      {/* Main loader */}
      <motion.div variants={itemVariants} className="relative mb-8">
        <motion.div
          className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center"
          animate={{
            boxShadow: [
              "0 0 20px rgba(79, 70, 229, 0.4)",
              "0 0 30px rgba(79, 70, 229, 0.6)",
              "0 0 20px rgba(79, 70, 229, 0.4)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-12 h-12 text-white" />
          </motion.div>
        </motion.div>

        {/* Orbiting elements */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: -360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <motion.div className="absolute top-1/2 -right-2 transform -translate-y-1/2">
            <Edit className="w-6 h-6 text-indigo-300 filter drop-shadow-lg" />
          </motion.div>
          
          <motion.div className="absolute top-1/2 -left-2 transform -translate-y-1/2">
            <Layers className="w-6 h-6 text-purple-300 filter drop-shadow-lg" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Progress bar */}
      {calculatedProgress !== undefined && (
        <motion.div variants={itemVariants} className="w-64 h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${calculatedProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </motion.div>
      )}

      {/* Text content */}
      <motion.div variants={itemVariants} className="text-center mb-8">
        <h2 className="text-2xl font-medium text-white mb-2">{title}</h2>
        <p className="text-white/60 mb-6">{description}</p>

        {/* Pro tips */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTip}
            className="bg-white/5 rounded-lg p-4 max-w-md border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start">
              <div className="bg-indigo-500/20 rounded-full p-2 mr-3">
                <ChevronRight className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-sm text-white/80">{tips[currentTip]}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Elapsed time */}
      {estimatedTime && (
        <motion.div variants={itemVariants} className="text-xs text-white/40">
          Time elapsed: {elapsedTime}s
        </motion.div>
      )}
    </motion.div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-[#030303]/90 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-[400px] bg-[#050510] rounded-xl flex items-center justify-center">
      {content}
    </div>
  )
}

export default LoadingScreen 