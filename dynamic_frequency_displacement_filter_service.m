function response = dynamic_frequency_displacement_filter_service(file_name, filter_type)
    tic
    loaded = load(strcat('/filter_staging/unfiltered/', file_name, '.mat'));
    accel_x = loaded.accel_x;
    accel_y = loaded.accel_y;
    accel_z = loaded.accel_z;
    data = [accel_x, accel_y, accel_z];
    result = struct();

if strcmp(filter_type, 'Gs')
        scale = 0.000122;
        result.accel_x = data(:,1) * scale;
        result.accel_y = data(:,2) * scale;
        result.accel_z = data(:,3) * scale;
        result.time = loaded.time;
elseif strcmp(filter_type, 'MSSq')
        scale = 0.0011964;
        result.accel_x = data(:,1) * scale;
        result.accel_y = data(:,2) * scale;
        result.accel_z = data(:,3) * scale;
        result.time = loaded.time;
elseif strcmp(filter_type, 'Displacement')
        scale = 0.0011964;
        data = data * scale;
        fs = 200;
        ts = 1/fs;
        dt2 = ts;
        N = size(data, 1);
        aRes = 16/2^15;
        mean_sig = [1 800];

        % time is ms-since-epoch, written directly by Python as an integer.
        % No string parsing needed at all - just plain numeric arithmetic.
        time_full = double(loaded.time(:));

        dynamic_displacement = zeros(N, 3);

        gap_thresh = 1000; % 1 second, expressed in milliseconds
        event_bounds = [];
        start_idx = 1;
for idx = 2:N
if (time_full(idx) - time_full(idx-1)) > gap_thresh
                event_bounds = [event_bounds; start_idx, idx-1];
                start_idx = idx;
end
end
        event_bounds = [event_bounds; start_idx, N];

for e = 1:size(event_bounds, 1)
            ev_start = event_bounds(e, 1);
            ev_end   = event_bounds(e, 2);
            ev_data  = data(ev_start:ev_end, :);
            Ne = size(ev_data, 1);

if Ne < 100
continue; % too short to filter meaningfully
end

            t_sk = 0:ts:(Ne-1)*ts;

for col = 1:3
                clear time cap_shk
                ax_sk = ev_data(:, col);
                Ax_real_sk = (ax_sk*aRes + 0.032)*9.81;
                Ax_real_sk_1024 = Ax_real_sk;

                sig = Ax_real_sk_1024 - mean(Ax_real_sk_1024);
                win_len = min(999, floor(Ne/2));
if mod(win_len, 2) == 0
                    win_len = win_len - 1;
end
                window = hamming(max(win_len, 8));
                noverlap = floor(length(window)/2);
                nfft = 2048;

                [Pxx, f] = cpsd(sig, sig, window, noverlap, nfft, fs);

                idx_f = f >= 0 & f <= 5;
                f_0_5 = f(idx_f);
                Pxx_0_5 = abs(Pxx(idx_f));
                [pks, locs] = findpeaks(Pxx_0_5, f_0_5);

if isempty(pks)
                    ft = 3.1; % fallback to original hardcoded value
else
                    [~, max_idx] = max(pks);
                    ft = locs(max_idx);
end

                k_val = ceil(fs*3/ft/2);
                r = k_val;
                Nd = 2*k_val + 1;

                Lc = zeros(Nd, Nd+2);
                Lc(:,1:Nd)   = Lc(:,1:Nd)   + eye(Nd);
                Lc(:,3:Nd+2) = Lc(:,3:Nd+2) + eye(Nd);
                Lc(:,2:Nd+1) = Lc(:,2:Nd+1) - 2*eye(Nd);
                La = eye(Nd);
                La(1) = 1/sqrt(2);
                La(end) = 1/sqrt(2);
                L = La*Lc;
                lambda = 46.81*Nd^(-1.95);
                Ca2d = (L'*L + lambda^2*eye(Nd+2)) \ (L'*La);
                Ca2drp2 = Ca2d(r+2, :);

                cap_shk1 = -Ax_real_sk_1024;
for m = 1:length(t_sk)
                    time(m) = t_sk(m);
                    cap_shk(m) = cap_shk1(m);
end
                time = time';
                cap_shk = cap_shk';

                ms_end = min(mean_sig(2), Ne);
                cap_shk = cap_shk - mean(cap_shk(mean_sig(1):ms_end));

                ddxt1 = cap_shk;
                xtr1 = zeros(size(ddxt1));
for j = r+1:length(ddxt1)-r
                    xtr1(j) = Ca2drp2*ddxt1(j-r:j+r)*dt2;
end
                dynamic_displacement_shk = -xtr1*1000;

                dynamic_displacement(ev_start:ev_end, col) = dynamic_displacement_shk;
end
end

        result.displacement_x = dynamic_displacement(:, 1);
        result.displacement_y = dynamic_displacement(:, 2);
        result.displacement_z = dynamic_displacement(:, 3);

        result.time = loaded.time;
else
        error('Unknown filter type: %s', filter_type);
end

    fields = fieldnames(result);
for i = 1:numel(fields)
if isnumeric(result.(fields{i})) && ~strcmp(fields{i}, 'time')
            result.(fields{i}) = round(result.(fields{i}), 6);
end
end
    result.elapsed = toc;
    save(strcat('/filter_staging/filtered/', file_name, '.mat'), '-struct', 'result');
    response = 'success';
end