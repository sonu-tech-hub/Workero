const authController = require('../../../src/controllers/authController');
const { promisePool } = require('../../../src/config/database');

// Mock the helpers
jest.mock('../../../src/utils/helpers', () => ({
  ...jest.requireActual('../../../src/utils/helpers'),
  sendOTP: jest.fn(() => Promise.resolve({ success: true })),
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  generateToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  sanitizeUser: jest.fn()
}));

describe('Auth Controller', () => {
  let mockReq, mockRes, mockConnection;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: { id: 1, user_type: 'worker' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockConnection = {
      query: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    promisePool.getConnection = jest.fn().mockResolvedValue(mockConnection);
    promisePool.query = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        mobile: '1234567890',
        password: 'password123',
        user_type: 'worker'
      };

      mockReq.body = userData;

      // Mock existing user check (no existing user)
      mockConnection.query
        .mockResolvedValueOnce([[]]) // No existing users
        .mockResolvedValueOnce([{ insertId: 1 }]) // User insert
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Worker profile insert
        .mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 }]); // OTP insert

      // Mock helpers
      const { hashPassword } = require('../../../src/utils/helpers');
      hashPassword.mockResolvedValue('hashedPassword');
      require('../../../src/utils/helpers').sendOTP.mockResolvedValue({ success: true });

      await authController.register(mockReq, mockRes);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Registration successful. Please verify OTP sent to your email.'
        })
      );
    });

    it('should return error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        mobile: '1234567890',
        password: 'password123',
        user_type: 'worker'
      };

      mockReq.body = userData;

      // Mock existing user found
      mockConnection.query.mockResolvedValueOnce([[{ id: 1 }]]);

      await authController.register(mockReq, mockRes);

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User with this email or mobile already exists'
      });
    });

    it('should handle registration errors', async () => {
      const userData = {
        email: 'test@example.com',
        mobile: '1234567890',
        password: 'password123',
        user_type: 'worker'
      };

      mockReq.body = userData;

      mockConnection.query.mockRejectedValue(new Error('Database error'));

      await authController.register(mockReq, mockRes);

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Registration failed. Please try again.'
        })
      );
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP, update user, store refresh token, and commit transaction successfully', async () => {
      mockReq.body = { identifier: '1234567890', otp: '123456' };

      const mockUser = { id: 1, is_verified: false, user_type: 'worker' };
      const mockOtp = { id: 5 };
      const mockUserDetails = {
        id: 1,
        email: 'test@example.com',
        mobile: '1234567890',
        user_type: 'worker',
        is_verified: true
      };

      // Mock the sequence of DB calls within the transaction
      mockConnection.query
        .mockResolvedValueOnce([[mockUser]]) // 1. Find user
        .mockResolvedValueOnce([[mockOtp]]) // 2. Find valid OTP
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // 3. Mark OTP as used
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // 4. Mark user as verified
        .mockResolvedValueOnce([[mockUserDetails]]) // 5. Fetch user details again
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // 6. Store refresh token

      const { generateToken, generateRefreshToken, sanitizeUser } = require('../../../src/utils/helpers');
      generateToken.mockReturnValue('jwt_token');
      generateRefreshToken.mockReturnValue('refresh_token');
      sanitizeUser.mockReturnValue({ id: 1, email: 'test@example.com' });

      // Execute
      await authController.verifyOTP(mockReq, mockRes);

      // Assert
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.query).toHaveBeenCalledWith(
        'UPDATE otps SET is_used = TRUE WHERE id = ?',
        [mockOtp.id]
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        'UPDATE users SET is_verified = TRUE WHERE id = ?',
        [mockUser.id]
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = ? WHERE id = ?',
        ['refresh_token', mockUser.id]
      );
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'OTP verified successfully',
        data: expect.objectContaining({
          user: { id: 1, email: 'test@example.com' },
          token: 'jwt_token',
          refreshToken: 'refresh_token'
        })
      }));
    });

    it('should rollback transaction if OTP is invalid', async () => {
      mockReq.body = { identifier: '1234567890', otp: '123456' };

      // Mock user exists, but OTP is invalid (query returns empty array)
      mockConnection.query
        .mockResolvedValueOnce([[{ id: 1, is_verified: false }]]) // 1. Find user
        .mockResolvedValueOnce([[]]); // 2. No valid OTP found

      // The controller will throw an ApiError. We expect the test to catch it.
      await expect(authController.verifyOTP(mockReq, mockRes)).rejects.toThrow('Invalid or expired OTP');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      mockReq.body = { login: 'test@example.com', password: 'password123' };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        user_type: 'worker',
        is_active: true
      };

      const mockProfile = {
        id: 1,
        user_id: 1,
        full_name: 'Test User'
      };

      promisePool.query
        .mockResolvedValueOnce([[mockUser]]) // User found
        .mockResolvedValueOnce([[mockProfile]]) // Profile found
        .mockResolvedValueOnce([{}]); // Refresh token update

      const { comparePassword, generateToken, generateRefreshToken, sanitizeUser } = require('../../../src/utils/helpers');
      comparePassword.mockResolvedValue(true);
      generateToken.mockReturnValue('jwt_token');
      generateRefreshToken.mockReturnValue('refresh_token');
      sanitizeUser.mockReturnValue({ id: 1, email: 'test@example.com' });

      await authController.login(mockReq, mockRes);

      expect(comparePassword).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(promisePool.query).toHaveBeenCalledWith(
        'UPDATE users SET refresh_token = ? WHERE id = ?',
        ['refresh_token', mockUser.id]
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Login successful',
        data: expect.objectContaining({
          user: { id: 1, email: 'test@example.com' },
          profile: mockProfile,
          accessToken: 'jwt_token',
          refreshToken: 'refresh_token'
        })
      }));
    });

    it('should return error for invalid credentials', async () => {
      mockReq.body = { login: 'test@example.com', password: 'wrongpassword' };

      promisePool.query.mockResolvedValueOnce([[]]); // No user found

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials'
      });
    });

    it('should return error for deactivated account', async () => {
      mockReq.body = { login: 'test@example.com', password: 'password123' };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        user_type: 'worker',
        is_active: false
      };

      promisePool.query.mockResolvedValueOnce([[mockUser]]);
      const { comparePassword } = require('../../../src/utils/helpers');
      comparePassword.mockResolvedValue(true);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        mobile: '1234567890',
        user_type: 'worker',
        is_verified: true,
        is_active: true,
        created_at: '2023-01-01'
      };

      const mockProfile = {
        id: 1,
        user_id: 1,
        full_name: 'Test User'
      };

      promisePool.query
        .mockResolvedValueOnce([[mockUser]]) // User found
        .mockResolvedValueOnce([[mockProfile]]); // Profile found

      await authController.getCurrentUser(mockReq, mockRes);

      expect(promisePool.query).toHaveBeenCalledWith(
        'SELECT id, email, mobile, user_type, is_verified, is_active, created_at FROM users WHERE id = ?',
        [1]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockUser,
          profile: mockProfile
        }
      });
    });

    it('should return error if user not found', async () => {
      promisePool.query.mockResolvedValueOnce([[]]); // No user found

      await authController.getCurrentUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockReq.body = {
        current_password: 'oldpassword',
        new_password: 'newpassword123'
      };

      const mockUser = { password: 'hashedOldPassword' };

      promisePool.query
        .mockResolvedValueOnce([[mockUser]]) // Current password fetch
        .mockResolvedValueOnce([]); // Password update

      const { comparePassword, hashPassword } = require('../../../src/utils/helpers');
      comparePassword.mockResolvedValue(true);
      hashPassword.mockResolvedValue('hashedNewPassword');

      await authController.changePassword(mockReq, mockRes);

      expect(comparePassword).toHaveBeenCalledWith('oldpassword', 'hashedOldPassword');
      expect(hashPassword).toHaveBeenCalledWith('newpassword123');
      expect(promisePool.query).toHaveBeenCalledWith(
        'UPDATE users SET password = ? WHERE id = ?',
        ['hashedNewPassword', 1]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });
    });

    it('should return error for incorrect current password', async () => {
      mockReq.body = {
        current_password: 'wrongpassword',
        new_password: 'newpassword123'
      };

      const mockUser = { password: 'hashedOldPassword' };

      promisePool.query.mockResolvedValueOnce([[mockUser]]);
      const { comparePassword } = require('../../../src/utils/helpers');
      comparePassword.mockResolvedValue(false);

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });
  });
});
