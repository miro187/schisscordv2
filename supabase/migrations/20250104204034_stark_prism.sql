/*
  # Update profile policies
  
  1. Changes
    - Add policy to allow users to insert their own profile
    - Keep existing policies for viewing and updating profiles
  
  2. Security
    - Users can only create their own profile
    - Profile creation is tied to user's auth.uid()
*/

-- Allow users to create their own profile
CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);