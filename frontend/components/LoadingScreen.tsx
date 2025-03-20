"use client"

import { motion } from "framer-motion"

interface LoadingScreenProps {
  title?: string;
  description?: string;
  fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = "Loading...",
  description = "Please wait while we process your request.",
  fullScreen = false
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.2,
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

  const content = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center"
    >
      {/* Skeleton loader */}
      <motion.div
        variants={itemVariants}
        className="w-16 h-16 rounded-full bg-white/10 animate-pulse mb-4"
      />
      
      {/* Text content */}
      <motion.div
        variants={itemVariants}
        className="text-center"
      >
        <h2 className="text-xl font-medium text-white mb-2">{title}</h2>
        <p className="text-white/60">{description}</p>
      </motion.div>
    </motion.div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-[#030303]/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      {content}
    </div>
  )
}

export default LoadingScreen 