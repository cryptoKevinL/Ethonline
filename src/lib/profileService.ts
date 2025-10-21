import { supabase, Employer, Employee, Employment, Wallet, EmployerProfileData, EmployeeProfileData, Payment } from './supabase'

export class ProfileService {
  // Save or update employer profile
  static async saveEmployerProfile(profileData: EmployerProfileData & { userId: string }) {
    try {
      const { data, error } = await supabase
        .from('employers')
        .upsert({
          id: profileData.userId,
          name: profileData.name,
          email: profileData.email,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()

      if (error) {
        throw error
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error saving employer profile:', error)
      return { success: false, error: error.message }
    }
  }

  // Save or update employee profile using wallet address to find existing employee
  static async saveEmployeeProfile(profileData: EmployeeProfileData) {
    try {
      let employeeId = null

      // Step 1: Check if employee exists by wallet address
      if (profileData.wallet_address) {
        const { data: existingWallet, error: walletError } = await supabase
          .from('wallets')
          .select('employee_id')
          .eq('account_address', profileData.wallet_address)
          .maybeSingle()

        if (walletError) {
          throw walletError
        }

        if (existingWallet) {
          employeeId = existingWallet.employee_id
          console.log('Found existing employee by wallet address:', employeeId)
        }
      }

      // Step 2: Check if employee exists by email (fallback) - only if email is provided
      if (!employeeId && profileData.email && profileData.email.trim() !== '') {
        const { data: existingEmployee, error: emailError } = await supabase
          .from('employees')
          .select('id')
          .eq('email', profileData.email)
          .maybeSingle()

        if (emailError) {
          throw emailError
        }

        if (existingEmployee) {
          employeeId = existingEmployee.id
          console.log('Found existing employee by email:', employeeId)
        }
      }

      // Step 3: Save/update the employee record
      const employeeData = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email || null, // Allow null emails
        updated_at: new Date().toISOString()
      }

      let employeeResult
      if (employeeId) {
        // Update existing employee
        const { data, error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', employeeId)
          .select()

        if (error) throw error
        employeeResult = data
        console.log('Updated existing employee')
      } else {
        // Create new employee (let Supabase assign ID)
        const { data, error } = await supabase
          .from('employees')
          .insert(employeeData)
          .select()

        if (error) throw error
        employeeResult = data
        employeeId = data[0].id
        console.log('Created new employee with ID:', employeeId)
      }

      // Step 4: Handle wallet entry (create or update)
      if (profileData.wallet_address) {
        // Check if this wallet address already exists for this employee
        const { data: existingWallet, error: checkError } = await supabase
          .from('wallets')
          .select('id, account_address, chain, token')
          .eq('employee_id', employeeId)
          .eq('account_address', profileData.wallet_address)
          .maybeSingle()

        if (checkError) {
          throw checkError
        }

        if (existingWallet) {
          // Update existing wallet with new preferences
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .update({
              chain: profileData.preferred_chain || existingWallet.chain || 'ethereum',
              token: profileData.preferred_token || existingWallet.token || 'usdc',
              secondary_chain_preference: profileData.secondary_chain || existingWallet.secondary_chain_preference || null,
              secondary_token_preference: profileData.secondary_token || existingWallet.secondary_token_preference || null
            })
            .eq('id', existingWallet.id)
            .select()

          if (walletError) {
            throw walletError
          }
          console.log('Updated existing wallet for employee:', employeeId)
        } else {
          // Create new wallet if this address doesn't exist for this employee
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .insert({
              employee_id: employeeId,
              chain: profileData.preferred_chain || 'ethereum',
              token: profileData.preferred_token || 'usdc',
              secondary_chain_preference: profileData.secondary_chain || null,
              secondary_token_preference: profileData.secondary_token || null,
              account_address: profileData.wallet_address,
              is_default: true
            })
            .select()

          if (walletError) {
            throw walletError
          }
          console.log('Created new wallet for employee:', employeeId)
        }
      } else {
        // Check if employee has any default wallet to update
        const { data: existingDefaultWallet, error: checkError } = await supabase
          .from('wallets')
          .select('id, chain, token')
          .eq('employee_id', employeeId)
          .eq('is_default', true)
          .maybeSingle()

        if (checkError) {
          throw checkError
        }

        if (existingDefaultWallet) {
          // Update existing default wallet preferences
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .update({
              chain: profileData.preferred_chain || existingDefaultWallet.chain || 'ethereum',
              token: profileData.preferred_token || existingDefaultWallet.token || 'usdc'
            })
            .eq('id', existingDefaultWallet.id)
            .select()

          if (walletError) {
            throw walletError
          }
          console.log('Updated existing default wallet preferences for employee:', employeeId)
        } else {
          // Create basic wallet entry even without address
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .insert({
              employee_id: employeeId,
              chain: profileData.preferred_chain || 'ethereum',
              token: profileData.preferred_token || 'usdc',
              secondary_chain_preference: profileData.secondary_chain || null,
              secondary_token_preference: profileData.secondary_token || null,
              account_address: '', // Empty address - can be filled later
              is_default: true
            })
            .select()

          if (walletError) {
            throw walletError
          }
          console.log('Created basic wallet entry for employee:', employeeId)
        }
      }

      return { success: true, data: employeeResult, employeeId }
    } catch (error) {
      console.error('Error saving employee profile:', error)
      return { success: false, error: error.message }
    }
  }

  // Get employer profile by ID
  static async getEmployerProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('employers')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error fetching employer profile:', error)
      return { success: false, error: error.message }
    }
  }

  // Get employee profile by ID
  static async getEmployeeProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error fetching employee profile:', error)
      return { success: false, error: error.message }
    }
  }

  // Get employee profile with wallet information
  static async getEmployeeProfileWithWallet(userId: string) {
    try {
      // Get employee data
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (employeeError) {
        throw employeeError
      }

      // Get employment and wallet data using the view
      const { data: employmentData, error: employmentError } = await supabase
        .from('v_employer_employee_summary')
        .select('*')
        .eq('employee_id', userId)
        .eq('is_default', true)
        .maybeSingle()

      if (employmentError) {
        throw employmentError
      }

      return { 
        success: true, 
        data: {
          employee: employeeData,
          employment: employmentData
        }
      }
    } catch (error) {
      console.error('Error fetching employee profile with wallet:', error)
      return { success: false, error: error.message }
    }
  }

  // Find employee by wallet address
  static async findEmployeeByWallet(walletAddress: string) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select(`
          *,
          employees!inner(*)
        `)
        .eq('account_address', walletAddress)
        .eq('is_default', true)
        .maybeSingle()

      if (error) {
        throw error
      }

      return { success: true, data }
    } catch (error) {
      console.error('Error finding employee by wallet:', error)
      return { success: false, error: error.message }
    }
  }

  // Load employee profile with wallet data for form population
  static async loadEmployeeProfile(profileData: { wallet_address?: string, email?: string }) {
    try {
      console.log('=== ProfileService.loadEmployeeProfile DEBUG ===');
      console.log('Input profileData:', profileData);
      
      let employeeId = null
      let employeeData = null
      let walletData = null

      // Step 1: Check if wallet exists in wallets table first
      if (profileData.wallet_address) {
        console.log('🔍 Step 1: Checking wallets table for address:', profileData.wallet_address);
        console.log('🔍 Searching for account_address =', `"${profileData.wallet_address}"`);
        console.log('🔍 Searching for is_default =', true);
        
        const { data: walletResult, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('account_address', profileData.wallet_address)
          .eq('is_default', true)
          .maybeSingle()

        console.log('Wallets table search result:', { walletResult, walletError });
        
        // Let's also check what's actually in the wallets table
        console.log('🔍 DEBUG: Let me check what wallets exist in the database...');
        const { data: allWallets, error: allWalletsError } = await supabase
          .from('wallets')
          .select('*')
          .limit(10)
        
        console.log('All wallets in database (first 10):', { allWallets, allWalletsError });

        if (walletError) {
          throw walletError
        }

        if (walletResult) {
          walletData = walletResult
          employeeId = walletResult.employee_id
          console.log('✅ Found wallet in wallets table, employee_id:', employeeId)
          
          // Step 2: Now get employee data using the employee_id
          console.log('🔍 Step 2: Getting employee data for employee_id:', employeeId);
          
          const { data: employeeResult, error: employeeError } = await supabase
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .maybeSingle()

          console.log('Employee table search result:', { employeeResult, employeeError });

          if (employeeError) {
            throw employeeError
          }

          if (employeeResult) {
            employeeData = employeeResult
            console.log('✅ Found employee data:', employeeData)
          } else {
            console.log('❌ No employee found for employee_id:', employeeId)
          }
        } else {
          console.log('❌ No wallet found in wallets table')
        }
      } else {
        console.log('⚠️ No wallet address provided for search')
      }

      // Step 3: If not found by wallet, try by email (only if email is provided)
      if (!employeeId && profileData.email && profileData.email.trim() !== '') {
        console.log('🔍 Step 3: Searching by email:', profileData.email);
        console.log('🔍 Searching for email =', `"${profileData.email}"`);
        
        const { data: employeeResult, error: employeeError } = await supabase
          .from('employees')
          .select('*')
          .eq('email', profileData.email)
          .maybeSingle()

        console.log('Email search result:', { employeeResult, employeeError });
        
        // Let's also check what's actually in the employees table
        console.log('🔍 DEBUG: Let me check what employees exist in the database...');
        const { data: allEmployees, error: allEmployeesError } = await supabase
          .from('employees')
          .select('*')
          .limit(10)
        
        console.log('All employees in database (first 10):', { allEmployees, allEmployeesError });

        if (employeeError) {
          throw employeeError
        }

        if (employeeResult) {
          employeeId = employeeResult.id
          employeeData = employeeResult
          console.log('✅ Found employee by email:', employeeId)

          // Get their default wallet
          console.log('🔍 Getting default wallet for employee:', employeeId);
          
          const { data: walletResult, error: walletError } = await supabase
            .from('wallets')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('is_default', true)
            .maybeSingle()

          console.log('Default wallet search result:', { walletResult, walletError });

          if (walletError) {
            throw walletError
          }

          walletData = walletResult
          if (walletData) {
            console.log('✅ Found default wallet for employee')
          } else {
            console.log('❌ No default wallet found for employee')
          }
        } else {
          console.log('❌ No employee found by email')
        }
      } else if (!employeeId) {
        console.log('⚠️ No email provided for search or email is empty')
      }

      const result = { 
        success: true, 
        data: {
          employee: employeeData,
          wallet: walletData,
          employeeId
        }
      }
      
      console.log('Final result:', result);
      console.log('=== END ProfileService.loadEmployeeProfile DEBUG ===');
      
      return result
    } catch (error) {
      console.error('❌ Error loading employee profile:', error)
      return { success: false, error: error.message }
    }
  }

  // Delete employer profile
  static async deleteEmployerProfile(userId: string) {
    try {
      const { error } = await supabase
        .from('employers')
        .delete()
        .eq('id', userId)

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting employer profile:', error)
      return { success: false, error: error.message }
    }
  }
// Add this method to your ProfileService class

// Get employee wallet data
static async getEmployeeWalletData(employeeId: string, employmentId?: string) {
  try {
    let query = supabase
      .from('wallets')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_default', true);

    // If employmentId is provided, prefer wallet linked to this employment
    if (employmentId) {
      query = query.eq('employment_id', employmentId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return { success: true, data: data || null };
  } catch (error) {
    console.error('Error fetching employee wallet data:', error);
    return { success: false, error: error.message, data: null };
  }
}
  // Delete employee profile
  static async deleteEmployeeProfile(userId: string) {
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', userId)

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting employee profile:', error)
      return { success: false, error: error.message }
    }
  }

  // Admin adds employee to company (creates employment relationship)
  static async addEmployeeToCompany(employerId: string, employeeId: string, employmentData: {
    role?: string
    payment_amount?: number
    payment_frequency?: number
    chain?: string
    token?: string
    token_contract?: string
    token_decimals?: number
  }) {
    try {
      // Create employment relationship
      const { data: employment, error: employmentError } = await supabase
        .from('employments')
        .upsert({
          employer_id: employerId,
          employee_id: employeeId,
          status: 'active',
          role: employmentData.role,
          payment_amount: employmentData.payment_amount,
          payment_frequency: employmentData.payment_frequency,
          chain: employmentData.chain,
          token: employmentData.token,
          token_contract: employmentData.token_contract,
          token_decimals: employmentData.token_decimals,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'employer_id,employee_id'
        })
        .select()

      if (employmentError) {
        throw employmentError
      }

      // Check if employee already has a wallet linked directly to them
      const { data: existingWallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_default', true)
        .maybeSingle()

      if (walletError) {
        throw walletError
      }

      // If employee has a wallet, also link it to the employment
      if (existingWallet && employment?.[0]?.id) {
        const { data: updatedWallet, error: updateError } = await supabase
          .from('wallets')
          .update({
            employment_id: employment[0].id,
            chain: employmentData.chain || existingWallet.chain,
            token: employmentData.token || existingWallet.token
          })
          .eq('id', existingWallet.id)
          .select()

        if (updateError) {
          console.log('Failed to link existing wallet to employment:', updateError)
        } else {
          console.log('Linked existing wallet to employment')
        }
      }

      return { success: true, data: employment }
    } catch (error) {
      console.error('Error adding employee to company:', error)
      return { success: false, error: error.message }
    }
  }

  // Search employees by name or wallet address
  static async searchEmployees(query: string) {
    try {
      console.log('🔍 Searching for:', query);
      
      // Check if query contains wallet indicators (0x or .eth)
      const isWalletSearch = query.includes('0x') || query.includes('.eth');
      
      if (isWalletSearch) {
        // Search in wallets table
        console.log('🔍 Searching wallets table for:', query);
        
        const { data: walletResults, error: walletError } = await supabase
          .from('wallets')
          .select(`
            *,
            employees!inner(
              id,
              first_name,
              last_name,
              email
            )
          `)
          .ilike('account_address', `%${query}%`)
          .limit(10);

        if (walletError) {
          throw walletError;
        }

        console.log('Wallet search results:', walletResults);
        
        return {
          success: true,
          data: walletResults?.map(wallet => ({
            id: wallet.employees.id,
            first_name: wallet.employees.first_name,
            last_name: wallet.employees.last_name,
            email: wallet.employees.email,
            wallet_address: wallet.account_address,
            chain: wallet.chain,
            token: wallet.token
          })) || []
        };
      } else {
        // Search in employees table by name
        console.log('🔍 Searching employees table for name:', query);
        
        // Handle full name search (e.g., "John Doe")
        const nameParts = query.trim().split(' ');
        let searchQuery = '';
        
        let employeeResults;
        let employeeError;
        
        if (nameParts.length > 1) {
          // Full name search: "John Doe" -> search for first_name=John AND last_name=Doe
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');
          console.log('🔍 Full name search - First:', firstName, 'Last:', lastName);
          
          const { data, error } = await supabase
            .from('employees')
            .select(`
              *,
              wallets(
                account_address,
                chain,
                token,
                secondary_chain_preference,
                secondary_token_preference,
                is_default
              )
            `)
            .ilike('first_name', `%${firstName}%`)
            .ilike('last_name', `%${lastName}%`)
            .limit(10);
            
          employeeResults = data;
          employeeError = error;
        } else {
          // Single name search: "John" -> search first_name OR last_name OR email
          console.log('🔍 Single name search for:', query);
          
          const { data, error } = await supabase
            .from('employees')
            .select(`
              *,
              wallets(
                account_address,
                chain,
                token,
                secondary_chain_preference,
                secondary_token_preference,
                is_default
              )
            `)
            .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(10);
            
          employeeResults = data;
          employeeError = error;
        }

        if (employeeError) {
          throw employeeError;
        }

        console.log('Employee search results:', employeeResults);
        
        return {
          success: true,
          data: employeeResults?.map(employee => ({
            id: employee.id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email || '', // Handle null emails
            wallet_address: employee.wallets?.[0]?.account_address || '',
            chain: employee.wallets?.[0]?.chain || '',
            token: employee.wallets?.[0]?.token || '',
            secondary_chain: employee.wallets?.[0]?.secondary_chain_preference || '',
            secondary_token: employee.wallets?.[0]?.secondary_token_preference || ''
          })) || []
        };
      }
    } catch (error) {
      console.error('Error searching employees:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Get all companies
  static async getAllCompanies() {
    try {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, email')
        .order('name');

      if (error) {
        throw error;
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching companies:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Create new company
  static async createCompany(companyData: { name: string, email: string }) {
    try {
      const { data, error } = await supabase
        .from('employers')
        .insert({
          name: companyData.name,
          email: companyData.email
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error creating company:', error);
      return { success: false, error: error.message };
    }
  }

  // Get specific payment group by employer ID
  static async getPaymentGroupById(employerId: string) {
    try {
      const { data, error } = await supabase
        .from('employments')
        .select(`
          *,
          employers!inner(
            id,
            name,
            email
          ),
          employees!inner(
            id,
            first_name,
            last_name,
            email
          ),
          wallets(
            id,
            account_address,
            chain,
            token,
            secondary_chain_preference,
            secondary_token_preference,
            is_default
          )
        `)
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return { success: false, error: 'Group not found', data: null };
      }

      // Get employer info from first record
      const employer = data[0].employers;
      
      // Process employees with their wallet info
      const employees = data.map(employment => {
        const employee = employment.employees;
        const wallet = employment.wallets?.[0]; // Get default wallet
        
        return {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email || '',
          wallet_address: wallet?.account_address || '',
          chain: employment.chain || wallet?.chain || 'ethereum',
          token: employment.token || wallet?.token || 'usdc',
          secondary_chain: wallet?.secondary_chain_preference || employment.secondary_chain_preference || null,
          secondary_token: wallet?.secondary_token_preference || employment.secondary_token_preference || null,
          payment_amount: employment.payment_amount || 0,
          payment_frequency: employment.payment_frequency || 'monthly',
          status: employment.status,
          role: employment.role,
          employment_id: employment.id
        };
      });

      // Calculate total payment in USDC
      const totalPayment = employees.reduce((sum, emp) => {
        const amount = parseFloat(emp.payment_amount || '0');
        const token = emp.token || 'usdc';
        return sum + this.convertToUSDC(amount, token);
      }, 0);

      const groupData = {
        id: employer.id,
        name: employer.name,
        email: employer.email,
        employees: employees,
        totalPayment: totalPayment,
        status: 'Active', // Default status
        created_at: data[0].created_at,
        // Add payment schedule fields from the first employment record
        payment_frequency: data[0].payment_frequency,
        payment_start_date: data[0].payment_start_date,
        payment_end_date: data[0].payment_end_date,
        payment_day_of_week: data[0].payment_day_of_week
      };

      return { success: true, data: groupData };
    } catch (error) {
      console.error('Error fetching payment group:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Get all payment groups (employments) for a company
  // Convert token amounts to USDC equivalent
  static convertToUSDC(amount: number, token: string): number {
    // Simple conversion rates (in production, you'd fetch these from an API like CoinGecko or CoinMarketCap)
    // Example: const rates = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd');
    const conversionRates: { [key: string]: number } = {
      'eth': 4000,    // 1 ETH = 2000 USDC (example rate - update with real rate)
      'usdc': 1,      // 1 USDC = 1 USDC
      'usdt': 1,      // 1 USDT = 1 USDC (approximate)
      'dai': 1,       // 1 DAI = 1 USDC (approximate)
      'weth': 4000,   // Wrapped ETH same as ETH
      'matic': 0.5,   // 1 MATIC = 0.5 USDC (example rate)
    };
    
    const rate = conversionRates[token.toLowerCase()] || 1;
    return amount * rate;
  }

  static async getPaymentGroups(employerId?: string) {
    try {
      let query = supabase
        .from('employments')
        .select(`
          *,
          employers!inner(
            id,
            name,
            email
          ),
          employees!inner(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      // If employerId is provided, filter by that employer
      if (employerId) {
        query = query.eq('employer_id', employerId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Group employments by employer to create "groups"
      const groupsMap = new Map();
      
      data?.forEach(employment => {
        const employerId = employment.employer_id;
        const employerName = employment.employers.name;
        
        if (!groupsMap.has(employerId)) {
          groupsMap.set(employerId, {
            id: employerId,
            name: employerName,
            employer: employment.employers,
            employees: [],
            totalPayment: 0,
            status: 'Active', // Default status
            nextPayment: 'TBD', // Default next payment
            created_at: employment.created_at
          });
        }
        
        const group = groupsMap.get(employerId);
        group.employees.push({
          id: employment.employee_id,
          first_name: employment.employees.first_name,
          last_name: employment.employees.last_name,
          email: employment.employees.email,
          payment_amount: employment.payment_amount,
          payment_frequency: employment.payment_frequency,
          chain: employment.chain,
          token: employment.token,
          status: employment.status,
          role: employment.role
        });
        
        // Convert to USDC and sum up total payments
        const paymentAmount = parseFloat(employment.payment_amount || '0');
        const token = employment.token || 'usdc';
        const usdcAmount = this.convertToUSDC(paymentAmount, token);
        group.totalPayment += usdcAmount;
      });

      // Convert map to array and format the data
      const groups = Array.from(groupsMap.values()).map(group => ({
        id: group.id,
        name: group.name,
        employer: group.employer,
        employees: group.employees.length,
        totalPayment: `$${group.totalPayment.toFixed(2)} USDC`,
        nextPayment: group.nextPayment,
        status: group.status,
        created_at: group.created_at,
        employeeDetails: group.employees // Keep detailed employee info for potential use
      }));

      return { success: true, data: groups };
    } catch (error) {
      console.error('Error fetching payment groups:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Create payment group (employment relationships)
  static async createPaymentGroup(groupData: {
    employerId: string;
    groupName: string;
    employees: Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      wallet_address: string;
      chain: string;
      token: string;
      secondary_chain?: string;
      secondary_token?: string;
      payment: string;
    }>;
    payment_frequency?: string;
    payment_start_date?: string;
    payment_end_date?: string;
    payment_day_of_week?: string;
  }) {
    try {
      console.log('Creating payment group:', groupData);
      
      const employmentRecords = [];
      
      // Process each employee
      for (const employee of groupData.employees) {
        console.log('Processing employee:', employee);
        
        let employeeId = null;
        
        // Step 1: Check if wallet address exists in wallets table
        if (employee.wallet_address && employee.wallet_address.trim() !== '') {
          console.log('Checking if wallet address exists:', employee.wallet_address);
          
          const { data: existingWallet, error: walletError } = await supabase
            .from('wallets')
            .select('employee_id')
            .eq('account_address', employee.wallet_address)
            .maybeSingle();

          if (walletError) {
            console.error('Error checking wallet:', walletError);
            throw walletError;
          }

          if (existingWallet) {
            employeeId = existingWallet.employee_id;
            console.log('Found existing employee by wallet address:', employeeId);
          }
        }
        
        // Step 2: If no wallet found, check if employee ID is a real ID (not temp)
        if (!employeeId && !employee.id.startsWith('temp-')) {
          console.log('Checking existing employee with ID:', employee.id);
          const { data: existingEmployee, error: checkError } = await supabase
            .from('employees')
            .select('id, first_name, last_name, email')
            .eq('id', employee.id)
            .maybeSingle();

          if (checkError) {
            console.error('Error checking employee:', checkError);
            throw checkError;
          }

          if (existingEmployee) {
            employeeId = existingEmployee.id;
            console.log('Found existing employee by ID:', employeeId);
          }
        }
        
        // Step 3: Only create new employee if we couldn't find an existing one
        if (!employeeId) {
          console.log('Creating new employee:', employee.first_name, employee.last_name);
          
          // Create new employee (email is now optional)
          const { data: newEmployee, error: employeeError } = await supabase
            .from('employees')
            .insert({
              first_name: employee.first_name,
              last_name: employee.last_name,
              email: employee.email || null // Allow null emails
            })
            .select()
            .single();

          if (employeeError) {
            console.error('Error creating employee:', employeeError);
            throw employeeError;
          }
          
          employeeId = newEmployee.id;
          console.log('Created new employee with ID:', employeeId);
        } else {
          console.log('Using existing employee with ID:', employeeId);
        }

        // Create employment record
        const employmentRecord = {
          employer_id: groupData.employerId,
          employee_id: employeeId,
          status: 'active',
          role: 'employee',
          payment_amount: (parseFloat(employee.payment) || 0).toString(),
          payment_frequency: groupData.payment_frequency || 'monthly',
          payment_start_date: groupData.payment_start_date || null,
          payment_end_date: groupData.payment_end_date || null,
          payment_day_of_week: groupData.payment_day_of_week || null,
          chain: employee.chain || 'ethereum',
          token: employee.token || 'usdc',
          secondary_chain_preference: employee.secondary_chain || null, // Secondary chain preference
          secondary_token_preference: employee.secondary_token || null, // Secondary token preference
          updated_at: new Date().toISOString()
        };

        employmentRecords.push(employmentRecord);
      }

      console.log('Creating employment records:', employmentRecords);
      console.log('Employment records count:', employmentRecords.length);

      // Insert all employment records
      const { data: employments, error: employmentError } = await supabase
        .from('employments')
        .insert(employmentRecords)
        .select();

      console.log('Employment insert result:', { employments, employmentError });

      if (employmentError) {
        console.error('Employment creation error:', employmentError);
        throw employmentError;
      }

      console.log('Created employment records:', employments);

      // Handle wallet linking
      for (let i = 0; i < groupData.employees.length; i++) {
        const employee = groupData.employees[i];
        const employment = employments[i];
        
        if (employee.wallet_address && employee.wallet_address.trim() !== '') {
          // Check if wallet exists for this employee and address
          const { data: existingWallet, error: walletError } = await supabase
            .from('wallets')
            .select('id, employment_id, chain, token')
            .eq('employee_id', employment.employee_id)
            .eq('account_address', employee.wallet_address)
            .maybeSingle();

          if (walletError) {
            console.error('Error checking wallet:', walletError);
            continue;
          }

          if (existingWallet) {
            // Update existing wallet to link to employment and update preferences
            const { error: updateError } = await supabase
              .from('wallets')
              .update({ 
                employment_id: employment.id,
                chain: employee.chain || existingWallet.chain || 'ethereum',
                token: employee.token || existingWallet.token || 'usdc',
                secondary_chain_preference: employee.secondary_chain || existingWallet.secondary_chain_preference || null,
                secondary_token_preference: employee.secondary_token || existingWallet.secondary_token_preference || null
              })
              .eq('id', existingWallet.id);

            if (updateError) {
              console.error('Error updating wallet:', updateError);
            } else {
              console.log('Updated existing wallet and linked to employment:', existingWallet.id);
            }
          } else {
          // Create new wallet entry linked to employment
          const { error: createError } = await supabase
            .from('wallets')
            .insert({
              employee_id: employment.employee_id,
              employment_id: employment.id,
              chain: employee.chain || 'ethereum',
              token: employee.token || 'usdc',
              secondary_chain_preference: employee.secondary_chain || null,
              secondary_token_preference: employee.secondary_token || null,
              account_address: employee.wallet_address,
              is_default: true
            });

            if (createError) {
              console.error('Error creating wallet:', createError);
            } else {
              console.log('Created new wallet for employment:', employment.id);
            }
          }
        }
      }

      return { success: true, data: employments };
    } catch (error) {
      console.error('Error creating payment group:', error);
      return { success: false, error: error.message };
    }
  }

  // Update employee payment amount
  static async updateEmployeePayment(employmentId: string, paymentAmount: number) {
    try {
      const { data, error } = await supabase
        .from('employments')
        .update({
          payment_amount: paymentAmount.toString(), // Convert to string for decimal storage
          updated_at: new Date().toISOString()
        })
        .eq('id', employmentId)
        .select();

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating employee payment:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove employee from group (delete employment)
  static async removeEmployeeFromGroup(employmentId: string) {
    try {
      // First, unlink any wallets from this employment (set employment_id to NULL)
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ employment_id: null })
        .eq('employment_id', employmentId);

      if (walletError) {
        console.error('Error unlinking wallets from employment:', walletError);
        // Continue with employment deletion even if wallet unlinking fails
      }

      // Then delete the employment record
      const { error } = await supabase
        .from('employments')
        .delete()
        .eq('id', employmentId);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing employee from group:', error);
      return { success: false, error: error.message };
    }
  }

  // Add employee to existing group
  static async addEmployeeToGroup(data: {
    employerId: string;
    employeeData: {
      first_name: string;
      last_name: string;
      email: string;
      wallet_address: string;
      chain: string;
      token: string;
      secondary_chain?: string;
      secondary_token?: string;
      payment: string;
    };
  }) {
    try {
      console.log('Adding employee to group:', data);

      let employeeId = null;

      // Step 1: Check if wallet address exists in wallets table
      if (data.employeeData.wallet_address && data.employeeData.wallet_address.trim() !== '') {
        console.log('Checking if wallet address exists:', data.employeeData.wallet_address);

        const { data: existingWallet, error: walletError } = await supabase
          .from('wallets')
          .select('employee_id')
          .eq('account_address', data.employeeData.wallet_address)
          .maybeSingle();

        if (walletError) {
          console.error('Error checking wallet:', walletError);
          throw walletError;
        }

        if (existingWallet) {
          employeeId = existingWallet.employee_id;
          console.log('Found existing employee by wallet address:', employeeId);
        }
      }

      // Step 2: If no wallet found, create new employee
      if (!employeeId) {
        console.log('Creating new employee:', data.employeeData.first_name, data.employeeData.last_name);

        // Create new employee (email is optional)
        const { data: newEmployee, error: employeeError } = await supabase
          .from('employees')
          .insert({
            first_name: data.employeeData.first_name,
            last_name: data.employeeData.last_name,
            email: data.employeeData.email || null // Allow null emails
          })
          .select()
          .single();

        if (employeeError) {
          console.error('Error creating employee:', employeeError);
          throw employeeError;
        }

        employeeId = newEmployee.id;
        console.log('Created new employee with ID:', employeeId);
      } else {
        console.log('Using existing employee with ID:', employeeId);
      }

      // Create employment record
      const employmentRecord = {
        employer_id: data.employerId,
        employee_id: employeeId,
        status: 'active',
        role: 'employee',
        payment_amount: (parseFloat(data.employeeData.payment) || 0).toString(),
        payment_frequency: 'monthly', // Default frequency
        chain: data.employeeData.chain || 'ethereum',
        token: data.employeeData.token || 'usdc',
        secondary_chain_preference: data.employeeData.secondary_chain || null,
        secondary_token_preference: data.employeeData.secondary_token || null,
        updated_at: new Date().toISOString()
      };

      console.log('Creating employment record:', employmentRecord);

      // Insert employment record
      const { data: employment, error: employmentError } = await supabase
        .from('employments')
        .insert(employmentRecord)
        .select()
        .single();

      console.log('Employment insert result:', { employment, employmentError });

      if (employmentError) {
        console.error('Employment creation error:', employmentError);
        throw employmentError;
      }

      console.log('Created employment record:', employment);

      // Handle wallet linking
      if (data.employeeData.wallet_address && data.employeeData.wallet_address.trim() !== '') {
        // Check if wallet exists for this employee and address
        const { data: existingWallet, error: walletError } = await supabase
          .from('wallets')
          .select('id, employment_id, chain, token')
          .eq('employee_id', employment.employee_id)
          .eq('account_address', data.employeeData.wallet_address)
          .maybeSingle();

        if (walletError) {
          console.error('Error checking wallet:', walletError);
          throw walletError;
        }

        if (existingWallet) {
          // Update existing wallet to link to employment and update preferences
          const { error: updateError } = await supabase
            .from('wallets')
            .update({
              employment_id: employment.id,
              chain: data.employeeData.chain || existingWallet.chain || 'ethereum',
              token: data.employeeData.token || existingWallet.token || 'usdc',
              secondary_chain_preference: data.employeeData.secondary_chain || existingWallet.secondary_chain_preference || null,
              secondary_token_preference: data.employeeData.secondary_token || existingWallet.secondary_token_preference || null
            })
            .eq('id', existingWallet.id);

          if (updateError) {
            console.error('Error updating wallet:', updateError);
            throw updateError;
          } else {
            console.log('Updated existing wallet and linked to employment:', existingWallet.id);
          }
        } else {
          // Create new wallet entry linked to employment
          const { error: createError } = await supabase
            .from('wallets')
            .insert({
              employee_id: employment.employee_id,
              employment_id: employment.id,
              chain: data.employeeData.chain || 'ethereum',
              token: data.employeeData.token || 'usdc',
              secondary_chain_preference: data.employeeData.secondary_chain || null,
              secondary_token_preference: data.employeeData.secondary_token || null,
              account_address: data.employeeData.wallet_address,
              is_default: true
            });

          if (createError) {
            console.error('Error creating wallet:', createError);
            throw createError;
          } else {
            console.log('Created new wallet for employment:', employment.id);
          }
        }
      }

      return { success: true, data: employment };
    } catch (error) {
      console.error('Error adding employee to group:', error);
      return { success: false, error: error.message };
    }
  }

  // Get employment data for a specific wallet address
  static async getEmploymentByWallet(walletAddress: string) {
    try {
      // First, find the wallet and get the employee_id
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('employee_id, employment_id')
        .eq('account_address', walletAddress)
        .maybeSingle();

      if (walletError) {
        throw walletError;
      }

      if (!wallet) {
        return { success: true, data: null }; // No wallet found
      }

      // Get employment data with employer and employee details
      const { data: employment, error: employmentError } = await supabase
        .from('employments')
        .select(`
          *,
          employers!inner(
            id,
            name,
            email
          ),
          employees!inner(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('employee_id', wallet.employee_id)
        .eq('status', 'active')
        .maybeSingle();

      if (employmentError) {
        throw employmentError;
      }

      if (!employment) {
        return { success: true, data: null }; // No active employment found
      }

      // Format the employment data
      const employmentData = {
        id: employment.id,
        company: employment.employers.name,
        companyEmail: employment.employers.email,
        employee: {
          id: employment.employees.id,
          first_name: employment.employees.first_name,
          last_name: employment.employees.last_name,
          email: employment.employees.email
        },
        monthlyPayment: employment.payment_amount || 0,
        paymentFrequency: employment.payment_frequency || 'monthly',
        chain: employment.chain || 'ethereum',
        token: employment.token || 'usdc',
        status: employment.status,
        role: employment.role,
        created_at: employment.created_at,
        updated_at: employment.updated_at
      };

      return { success: true, data: employmentData };
    } catch (error) {
      console.error('Error fetching employment by wallet:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Get employer transactions from Blockscout API via Supabase function
  static async getEmployerTransactions(employerAddress: string, limit: number = 20) {
    try {
      console.log('Fetching transactions for employer:', employerAddress);
      
      // Use Supabase function to avoid CORS issues
      const response = await fetch(
        `https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=optimism-sepolia&address=${employerAddress}&offset=${limit}&api=v2`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format the transaction data from Blockscout API response
      const formattedTransactions = data.result?.map((tx: any) => ({
        hash: tx.hash,
        timestamp: tx.timeStamp,
        value: tx.value,
        valueFormatted: (parseInt(tx.value) / Math.pow(10, 18)).toFixed(6) + ' ETH', // Convert wei to ETH
        from: tx.from,
        to: tx.to,
        status: tx.isError === '0' ? 'success' : 'failed',
        method: tx.methodId,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        blockNumber: parseInt(tx.blockNumber),
        transactionIndex: parseInt(tx.transactionIndex)
      })) || [];

      return {
        success: true,
        data: formattedTransactions
      };
    } catch (error) {
      console.error('Error fetching employer transactions:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Get payment transactions (incoming to employee wallet)
  static async getPaymentTransactions(employeeWallet: string, employerAddress: string, limit: number = 10) {
    try {
      console.log('Fetching payment transactions for employee:', employeeWallet);
      
      // Use Supabase function to avoid CORS issues
      const response = await fetch(
        `https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=optimism-sepolia&address=${employeeWallet}&offset=${limit}&api=v2`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter for transactions from the employer (payments)
      const paymentTransactions = data.result?.filter((tx: any) => 
        tx.from?.toLowerCase() === employerAddress.toLowerCase() &&
        parseInt(tx.value) > 0 &&
        tx.isError === '0'
      ).map((tx: any) => ({
        hash: tx.hash,
        timestamp: tx.timeStamp,
        value: tx.value,
        valueFormatted: (parseInt(tx.value) / Math.pow(10, 18)).toFixed(6) + ' ETH',
        from: tx.from,
        to: tx.to,
        status: tx.isError === '0' ? 'success' : 'failed',
        method: tx.methodId,
        gasUsed: tx.gasUsed,
        blockNumber: parseInt(tx.blockNumber),
        isPayment: true
      })) || [];

      return {
        success: true,
        data: paymentTransactions
      };
    } catch (error) {
      console.error('Error fetching payment transactions:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  // Send email notification for new payment
  static async sendPaymentNotification(employeeEmail: string, paymentData: any) {
    try {
      // This would integrate with your email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the notification
      console.log('📧 Email notification would be sent to:', employeeEmail);
      console.log('📧 Payment details:', {
        amount: paymentData.valueFormatted,
        chain: paymentData.chain,
        txHash: paymentData.hash,
        intentId: paymentData.intentId
      });
      
      // TODO: Implement actual email sending
      // Example with SendGrid:
      // await sgMail.send({
      //   to: employeeEmail,
      //   from: 'noreply@yourcompany.com',
      //   subject: '💰 New Payment Received!',
      //   html: `
      //     <h2>Payment Received!</h2>
      //     <p>You have received a new payment of ${paymentData.valueFormatted}</p>
      //     <p>Chain: ${paymentData.chain}</p>
      //     <p>Transaction: ${paymentData.hash}</p>
      //   `
      // });
      
      return { success: true };
    } catch (error) {
      console.error('Error sending payment notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get real-time transaction monitoring setup - uses Supabase real-time subscriptions
  static setupTransactionMonitoring(employeeWallet: string, employerAddress: string, onNewTransaction: (tx: any) => void) {
    try {
      console.log('🔔 Setting up real-time payment monitoring via Supabase...');
      console.log('📧 Monitoring for employee wallet:', employeeWallet);
      
      // Subscribe to new payments in the database for this employee
      const subscription = supabase
        .channel(`payment-notifications-${employeeWallet}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'payments',
            filter: `recipient=eq.${employeeWallet}`
          },
          async (payload) => {
            console.log('💰 New payment detected in database:', payload.new);
            
            const payment = payload.new;
            
            // Get employee email for notifications
            try {
              const { data: employeeData } = await supabase
                .from('employees')
                .select('email')
                .eq('id', payment.employee_id)
                .single();
              
              if (employeeData?.email) {
                // Send email notification
                await this.sendPaymentNotification(employeeData.email, {
                  valueFormatted: `${payment.amount_token} ${payment.token?.toUpperCase()}`,
                  chain: payment.chain,
                  hash: payment.tx_hash,
                  intentId: payment.intent_id
                });
              }
            } catch (error) {
              console.log('Could not send email notification:', error);
            }
            
            // Format the payment data for notification
            const formattedPayment = {
              id: payment.id,
              hash: payment.tx_hash,
              from: 'Employer', // We could get the actual employer name from the employment data
              to: payment.recipient,
              value: payment.amount_token,
              valueFormatted: `${payment.amount_token} ${payment.token?.toUpperCase()}`,
              timestamp: payment.created_at,
              chain: payment.chain,
              status: payment.status,
              intentId: payment.intent_id,
              depositSolver: payment.deposit_solver_address,
              depositTx: payment.first_tx_hash
            };
            
            // Trigger the notification callback
            onNewTransaction(formattedPayment);
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to payment notifications');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Failed to subscribe to payment notifications - real-time may not be enabled');
          }
        });

      // Return cleanup function
      return () => {
        console.log('🔕 Stopping payment monitoring...');
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up transaction monitoring:', error);
      return () => {}; // Return empty cleanup function
    }
  }

  // Get dashboard statistics for a specific company
  static async getCompanyDashboardStats(employerId: string) {
    try {
      // Get all employments for this company
      const { data: employments, error: employmentError } = await supabase
        .from('employments')
        .select(`
          *,
          employees!inner(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('employer_id', employerId);

      if (employmentError) {
        throw employmentError;
      }

      if (!employments || employments.length === 0) {
        return {
          success: true,
          data: {
            totalEmployees: 0,
            activeGroups: 0,
            monthlyPayout: 0,
            pendingPayments: 0,
            recentGroups: []
          }
        };
      }

      // Calculate statistics
      const totalEmployees = employments.length;
      const activeGroups = 1; // Since we group by employer, each employer = 1 group
      const monthlyPayout = employments.reduce((sum, emp) => sum + (emp.payment_amount || 0), 0);
      const pendingPayments = employments.filter(emp => emp.status === 'pending').length;

      // Get recent groups (just the current company info)
      const { data: employer, error: employerError } = await supabase
        .from('employers')
        .select('*')
        .eq('id', employerId)
        .single();

      if (employerError) {
        throw employerError;
      }

      const recentGroups = [{
        id: employer.id,
        name: employer.name,
        employees: totalEmployees,
        payout: monthlyPayout,
        status: 'Active',
        created_at: employer.created_at
      }];

      return {
        success: true,
        data: {
          totalEmployees,
          activeGroups,
          monthlyPayout,
          pendingPayments,
          recentGroups
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Employee Dashboard Functions
  static async getEmployeeDashboardStats(walletAddress: string) {
    try {
      console.log('Fetching employee dashboard stats for wallet:', walletAddress);
      
      // First, find all wallets for this address to get employee_id
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('employee_id, employment_id')
        .eq('account_address', walletAddress);

      if (walletError) {
        console.error('Error fetching wallet data:', walletError);
        return { success: false, error: walletError.message, data: null };
      }

      if (!wallets || wallets.length === 0) {
        console.log('=== EMPLOYEE DASHBOARD DEBUG ===');
        console.log('Input wallet address:', walletAddress);
        console.log('No wallet data found for address:', walletAddress);
        console.log('=== END DEBUG ===');
        return { 
          success: true, 
          data: {
            totalEarned: 0,
            activeEmployments: 0,
            activeContracts: 0,
            nextPayment: null,
            recentActivity: []
          }
        };
      }

      // Get all unique employee_ids from the wallets
      const employeeIds = [...new Set(wallets.map(w => w.employee_id).filter(Boolean))];
      
      if (employeeIds.length === 0) {
        console.log('=== EMPLOYEE DASHBOARD DEBUG ===');
        console.log('Input wallet address:', walletAddress);
        console.log('Found wallets:', wallets);
        console.log('No employee IDs found for wallet:', walletAddress);
        console.log('=== END DEBUG ===');
        return { 
          success: true, 
          data: {
            totalEarned: 0,
            activeEmployments: 0,
            activeContracts: 0,
            nextPayment: null,
            recentActivity: []
          }
        };
      }

      // Get all employments for these employee_ids
      const { data: employmentData, error: employmentError } = await supabase
        .from('employments')
        .select(`
          id,
          employer_id,
          employee_id,
          payment_amount,
          payment_frequency,
          status,
          created_at,
          employers!inner(
            name,
            email
          )
        `)
        .in('employee_id', employeeIds);

      if (employmentError) {
        console.error('Error fetching employment data:', employmentError);
        return { success: false, error: employmentError.message, data: null };
      }

      if (!employmentData || employmentData.length === 0) {
        console.log('=== EMPLOYEE DASHBOARD DEBUG ===');
        console.log('Input wallet address:', walletAddress);
        console.log('Found wallets:', wallets);
        console.log('Employee IDs extracted:', employeeIds);
        console.log('No employment data found for employee IDs:', employeeIds);
        console.log('=== END DEBUG ===');
        return { 
          success: true, 
          data: {
            totalEarned: 0,
            activeEmployments: 0,
            activeContracts: 0,
            nextPayment: null,
            recentActivity: []
          }
        };
      }

      // Get all active employments (regardless of payments)
      const activeEmployments = employmentData.filter(employment => 
        employment.status === 'active'
      );

      // Check for actual payments made (via Blockscout API)
      let totalEarnedFromPayments = 0;
      let activeContractsWithPayments = 0;
      
      for (const employment of activeEmployments) {
        const employer = Array.isArray(employment.employers) ? employment.employers[0] : employment.employers;
        
        if (employer?.email) {
          // For demo purposes, we'll use a test employer address
          // In production, you'd need to map employer email to their wallet address
          const TEST_EMPLOYER_ADDRESS = "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6";
          
          try {
            const paymentResult = await this.getPaymentTransactions(walletAddress, TEST_EMPLOYER_ADDRESS, 5);
            if (paymentResult.success && paymentResult.data.length > 0) {
              // Calculate total earned from actual payments
              const paymentsFromThisEmployer = paymentResult.data.reduce((sum, tx) => {
                return sum + parseFloat(tx.valueFormatted || '0');
              }, 0);
              totalEarnedFromPayments += paymentsFromThisEmployer;
              activeContractsWithPayments++;
            }
          } catch (error) {
            console.log('Could not fetch payment data for employer:', employer.name);
          }
        }
      }

      // Calculate total potential earnings (from employment records)
      const totalPotentialEarnings = employmentData.reduce((sum, employment) => {
        return sum + parseFloat(employment.payment_amount || '0');
      }, 0);

      // Get next payment info (simplified - could be enhanced with actual payment schedules)
      const nextPayment = activeEmployments.find(employment => 
        employment.status === 'active'
      );

      // Get recent activity (last 5 employments)
      const recentActivity = employmentData
        .sort((a, b) => {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, 5)
        .map(employment => {
          const employer = Array.isArray(employment.employers) ? employment.employers[0] : employment.employers;
          return {
            title: employment.status === 'active' ? 'Active Employment' : 'Contract Ended',
            amount: `$${parseFloat(employment.payment_amount || '0').toFixed(2)}`,
            date: new Date(employment.created_at || 0).toLocaleDateString(),
            company: employer?.name || 'Unknown Company'
          };
        });

      const dashboardData = {
        totalEarned: totalEarnedFromPayments, // Actual payments received
        totalPotentialEarnings, // Potential earnings from employment records
        activeEmployments: activeEmployments.length, // Employment relationships
        activeContracts: activeContractsWithPayments, // Employment relationships with actual payments
        nextPayment: nextPayment ? {
          days: 5, // Simplified - could calculate actual days
          amount: parseFloat(nextPayment.payment_amount || '0')
        } : null,
        recentActivity
      };

      console.log('=== EMPLOYEE DASHBOARD DEBUG ===');
      console.log('Input wallet address:', walletAddress);
      console.log('Found wallets:', wallets);
      console.log('Employee IDs extracted:', employeeIds);
      console.log('Employment data found:', employmentData);
      console.log('Active employments:', activeEmployments);
      console.log('Final dashboard data:', dashboardData);
      console.log('=== END DEBUG ===');
      return { success: true, data: dashboardData };

    } catch (error) {
      console.error('Error fetching employee dashboard stats:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Save payment to database
  static async savePayment(paymentData: {
    employment_id: string;
    employer_id: string;
    employee_id: string;
    chain: string;
    token: string;
    token_contract?: string;
    token_decimals?: number;
    amount_token: string;
    recipient: string;
    tx_hash?: string;
    intent_id: string;
    first_tx_hash: string;
    solver_to_employer_hash?: string;
    deposit_solver_address?: string;
    solver_address?: string;
    status?: 'pending' | 'confirmed' | 'failed';
    period_start?: string;
    period_end?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          employment_id: paymentData.employment_id,
          employer_id: paymentData.employer_id,
          employee_id: paymentData.employee_id,
          chain: paymentData.chain,
          token: paymentData.token,
          token_contract: paymentData.token_contract,
          token_decimals: paymentData.token_decimals,
          amount_token: paymentData.amount_token,
          recipient: paymentData.recipient,
          tx_hash: paymentData.tx_hash,
          intent_id: paymentData.intent_id,
          first_tx_hash: paymentData.first_tx_hash,
          solver_to_employer_hash: paymentData.solver_to_employer_hash,
          deposit_solver_address: paymentData.deposit_solver_address,
          solver_address: paymentData.solver_address,
          status: paymentData.status || 'pending',
          period_start: paymentData.period_start,
          period_end: paymentData.period_end,
          pay_date: new Date().toISOString().split('T')[0] // Current date in YYYY-MM-DD format
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error saving payment:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error saving payment:', error);
      return { success: false, error: error.message };
    }
  }

  static async updatePaymentSolverHash(intentId: string, solverToEmployerHash: string) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({ solver_to_employer_hash: solverToEmployerHash })
        .eq('intent_id', intentId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating payment solver hash:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating payment solver hash:', error);
      return { success: false, error: error.message };
    }
  }

  // Get payments for an employer
  static async getEmployerPayments(employerId: string, limit: number = 50) {
    try {
      const timestamp = new Date().toISOString();
      console.log('🔍 [', timestamp, '] Fetching payments for employer:', employerId, 'with limit:', limit);
      
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          employments!inner(
            id,
            role,
            payment_amount,
            payment_frequency,
            employees!inner(
              id,
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .abortSignal(AbortSignal.timeout(10000)); // 10 second timeout

      if (error) {
        console.error('❌ [', timestamp, '] Database error:', error);
        throw error;
      }

      console.log('📊 [', timestamp, '] Raw database results:', data?.length, 'payments');
      console.log('🎯 [', timestamp, '] Intent IDs from DB:', data?.map(p => p.intent_id));
      console.log('⏰ [', timestamp, '] Created dates:', data?.map(p => p.created_at));
      
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching employer payments:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Get payments for an employee
  static async getEmployeePayments(employeeId: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          employments!inner(
            id,
            role,
            payment_amount,
            payment_frequency,
            employers!inner(
              id,
              name,
              email
            )
          )
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching employee payments:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Update payment status (e.g., when transaction is confirmed)
  static async updatePaymentStatus(paymentId: string, status: 'pending' | 'confirmed' | 'failed', tx_hash?: string) {
    try {
      const updateData: any = { status };
      if (tx_hash) {
        updateData.tx_hash = tx_hash;
      }

      const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating payment status:', error);
      return { success: false, error: error.message };
    }
  }

  // Find employment_id by employer_id and employee_id
  static async findEmploymentId(employerId: string, employeeId: string) {
    try {
      const { data, error } = await supabase
        .from('employments')
        .select('id')
        .eq('employer_id', employerId)
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return { success: true, data: data?.id || null };
    } catch (error) {
      console.error('Error finding employment_id:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Get payment by intent ID
  static async getPaymentByIntentId(intentId: string) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          employments!inner(
            id,
            role,
            payment_amount,
            payment_frequency,
            employees!inner(
              id,
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('intent_id', intentId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching payment by intent ID:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  // Update payment schedule for a group/employer
  static async updatePaymentSchedule(employerId: string, scheduleData: {
    payment_frequency: string;
    payment_start_date: string;
    payment_end_date?: string;
    payment_day_of_week: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('employments')
        .update({
          payment_frequency: scheduleData.payment_frequency,
          payment_start_date: scheduleData.payment_start_date,
          payment_end_date: scheduleData.payment_end_date || null,
          payment_day_of_week: scheduleData.payment_day_of_week,
          updated_at: new Date().toISOString()
        })
        .eq('employer_id', employerId)
        .select();

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating payment schedule:', error);
      return { success: false, error: error.message };
    }
  }
}
