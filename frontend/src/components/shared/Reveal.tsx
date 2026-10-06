import { motion, type HTMLMotionProps } from 'framer-motion';

export const Reveal = ({ delay = 0, y = 26, ...p }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) => (
  <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-70px' }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} {...p} />
);
