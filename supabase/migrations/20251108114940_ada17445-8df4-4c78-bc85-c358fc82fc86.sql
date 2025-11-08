-- Create RLS policies for admins to manage user roles
CREATE POLICY "Admins can view all user roles"
ON user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user roles"
ON user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
ON user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create RLS policy for admins to update all profiles
CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));