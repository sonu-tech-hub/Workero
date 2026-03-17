import api from './axiosInstance';

// Get all active categories with worker counts
export const getAllCategories = () => api.get('/categories');

// Get popular categories
export const getPopularCategories = (limit = 10) =>
  api.get('/categories/popular', { params: { limit } });

// Get single category + workers in it
export const getCategoryById = (categoryId) =>
  api.get(`/categories/${categoryId}`);
