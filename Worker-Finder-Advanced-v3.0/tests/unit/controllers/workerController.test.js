const workerController = require('../../../src/controllers/workerController');
const { promisePool } = require('../../../src/config/database');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../../src/config/cloudinary');
const aiService = require('../../../src/services/aiService');

// Mock Cloudinary functions
jest.mock('../../../src/config/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn()
}));

jest.mock('../../../src/services/aiService', () => ({
  analyzeWorkerPerformance: jest.fn(),
  rankWorkersForJob: jest.fn((job, workers) => workers)
}));

describe('Worker Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      user: { id: 1 },
      params: {},
      query: {},
      body: {},
      file: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    promisePool.execute = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateWorkerProfile', () => {
    it('should update worker profile successfully', async () => {
      const profileData = {
        full_name: 'John Doe',
        profession: 'Electrician',
        experience_years: 5,
        is_available: true,
        skills: ['wiring', 'repairs']
      };

      mockReq.body = profileData;

      const mockProfileFromDb = {
        ...profileData,
        user_id: 1,
        skills: JSON.stringify(profileData.skills),
        certifications: '[]',
        languages: '[]'
      };

      promisePool.execute
        .mockResolvedValueOnce([{}]) // Update query
        .mockResolvedValueOnce([[mockProfileFromDb]]); // Get updated profile

      await workerController.updateWorkerProfile(mockReq, mockRes);

      expect(promisePool.execute).toHaveBeenCalledTimes(2);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: {
          ...mockProfileFromDb,
          skills: profileData.skills,
          certifications: [],
          languages: []
        }
      });
    });

    it('should handle update errors', async () => {
      mockReq.body = { full_name: 'John Doe' };

      promisePool.execute.mockRejectedValue(new Error('Database error'));

      // asyncHandler will catch and pass to error handler middleware
      // so we just check if it throws
      await expect(workerController.updateWorkerProfile(mockReq, mockRes))
        .rejects.toThrow('Database error');
    });
  });

  describe('uploadProfilePhoto', () => {
    it('should upload profile photo successfully', async () => {
      mockReq.file = { buffer: Buffer.from('fake image data') };

      const mockProfile = { profile_photo_public_id: 'old_public_id' };
      const mockUploadResult = {
        secure_url: 'https://cloudinary.com/new_photo.jpg',
        public_id: 'new_public_id'
      };

      promisePool.execute.mockResolvedValueOnce([[mockProfile]]);
      uploadToCloudinary.mockResolvedValue(mockUploadResult);
      deleteFromCloudinary.mockResolvedValue({});

      await workerController.uploadProfilePhoto(mockReq, mockRes);

      expect(uploadToCloudinary).toHaveBeenCalledWith(
        mockReq.file.buffer,
        'profiles',
        null
      );
      expect(promisePool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE worker_profiles SET profile_photo_url = ?, profile_photo_public_id = ?'),
        [mockUploadResult.secure_url, mockUploadResult.public_id, 1]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile photo uploaded successfully',
        data: {
          url: mockUploadResult.secure_url,
          public_id: mockUploadResult.public_id
        }
      });
    });

    it('should return error if no file uploaded', async () => {
      await workerController.uploadProfilePhoto(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No image file provided' }));
    });
  });

  describe('uploadVerificationProof', () => {
    it('should upload verification proof successfully', async () => {
      mockReq.file = { buffer: Buffer.from('fake proof data') };

      const mockUploadResult = {
        secure_url: 'https://cloudinary.com/proof.jpg'
      };

      uploadToCloudinary.mockResolvedValue(mockUploadResult);

      await workerController.uploadVerificationProof(mockReq, mockRes);

      expect(uploadToCloudinary).toHaveBeenCalledWith(
        mockReq.file.buffer,
        'verifications',
        null
      );
      expect(promisePool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE worker_profiles SET verification_proof_url = ?, is_verified = FALSE'),
        [mockUploadResult.secure_url, 1]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Verification document uploaded. Under review.',
        data: { proof_url: mockUploadResult.secure_url }
      });
    });
  });

  describe('getWorkerProfile', () => {
    it('should get worker profile successfully', async () => {
      mockReq.params.workerId = '1';

      const mockWorker = {
        user_id: 1,
        full_name: 'John Doe',
        skills: '["skill1","skill2"]',
        certifications: '["cert1"]',
        languages: '["English"]',
        email: 'john@example.com',
        is_verified: true
      };

      const mockReviews = [
        { id: 1, rating: 5, review_text: 'Great work!', photos: '[]' }
      ];
      const mockPerformance = { tier: 'Gold' };
      aiService.analyzeWorkerPerformance.mockReturnValue(mockPerformance);

      promisePool.execute
        .mockResolvedValueOnce([[mockWorker]]) // Worker profile
        .mockResolvedValueOnce([mockReviews]); // Reviews

      await workerController.getWorkerProfile(mockReq, mockRes);

      expect(promisePool.execute).toHaveBeenCalledTimes(2);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockWorker,
          skills: ['skill1', 'skill2'],
          certifications: ['cert1'],
          languages: ['English'],
          recent_reviews: [{ ...mockReviews[0], photos: [] }],
          ai_performance: mockPerformance
        },
        cached: false
      });
    });

    it('should return 404 if worker not found', async () => {
      mockReq.params.workerId = '999';

      promisePool.execute.mockResolvedValueOnce([[]]); // No worker found

      // asyncHandler will throw, which is caught by error handler middleware
      await expect(workerController.getWorkerProfile(mockReq, mockRes))
        .rejects.toThrow('Worker not found');
    });
  });

  describe('searchWorkers', () => {
    it('should search workers successfully', async () => {
      mockReq.query = {
        latitude: '28.6139',
        longitude: '77.2090',
        radius: '10',
        profession: 'Electrician',
        page: '1',
        limit: '10'
      };

      const mockWorkers = [
        {
          user_id: 1,
          full_name: 'John Doe',
          skills: '["skill1"]',
          languages: '[]',
          certifications: '["cert1"]',
          distance: 5.5
        }
      ];

      const mockCount = [{ total: 1 }];

      promisePool.execute
        .mockResolvedValueOnce([mockCount]) // Count query
        .mockResolvedValueOnce([mockWorkers]) // Workers query

      await workerController.searchWorkers(mockReq, mockRes);

      expect(promisePool.execute).toHaveBeenCalledTimes(2);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          workers: [{
            ...mockWorkers[0],
            skills: ['skill1'],
            languages: [],
            certifications: ['cert1']
          }],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1
          },
          filters_applied: expect.objectContaining({
            profession: 'Electrician'
          })
        }
      });
    });
  });
  describe('getWorkerStats', () => {
    it('should get worker stats successfully', async () => {
      const mockProfile = {
        user_id: 1,
        full_name: 'John Doe',
        skills: '["skill1"]',
        certifications: '["cert1"]',
        languages: '[]',
        total_jobs: 10,
        average_rating: 4.5,
        total_earnings: 5000
      };

      const mockJobStats = {
        total_jobs: 10,
        completed_jobs: 8,
        active_jobs: 1,
        pending_jobs: 1,
        cancelled_jobs: 0
      };

      const mockEarnings = [{ monthly_earnings: 1500 }];
      const mockReviews = [{ id: 1, rating: 5 }];
      const mockUnread = [{ count: 2 }];
      const mockPerformance = { tier: 'Silver' };
      aiService.analyzeWorkerPerformance.mockReturnValue(mockPerformance);

      promisePool.execute
        .mockResolvedValueOnce([[mockProfile]]) // Profile
        .mockResolvedValueOnce([[mockJobStats]]) // Job stats
        .mockResolvedValueOnce([mockEarnings]) // Earnings
        .mockResolvedValueOnce([mockReviews]) // Reviews
        .mockResolvedValueOnce([mockUnread]) // Messages
        .mockResolvedValueOnce([mockUnread]); // Notifications

      await workerController.getWorkerStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: {
            ...mockProfile,
            skills: ['skill1'],
            certifications: ['cert1'],
            languages: []
          },
          job_stats: mockJobStats,
          monthly_earnings: mockEarnings,
          recent_reviews: mockReviews,
          unread_messages: 2,
          unread_notifications: 2,
          ai_performance: mockPerformance
        },
        cached: false
      });
    });
  });

  describe('updateAvailability', () => {
    it('should update availability successfully', async () => {
      mockReq.body = { is_available: false };

      promisePool.execute.mockResolvedValueOnce([{}]);

      await workerController.updateAvailability(mockReq, mockRes);

      expect(promisePool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE worker_profiles SET is_available = ?'),
        [0, 1]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'You are now unavailable for work',
        data: { is_available: false }
      });
    });
  });
});
