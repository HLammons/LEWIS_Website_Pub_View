function response = filter_service(file_name, filter_type)
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

    elseif strcmp(filter_type, 'MSSq')
        scale = 0.0011964;
        result.accel_x = data(:,1) * scale;
        result.accel_y = data(:,2) * scale;
        result.accel_z = data(:,3) * scale;

    elseif strcmp(filter_type, 'Displacement')
        scale = 0.0011964;
        data = data * scale;
        fs=200;
        ts=1/fs;
        dt2 = (ts);
        N = size(data, 1);
        t_sk = 0:ts:(N-1)*ts;
        aRes = 16/2^15;
        ft = [3.1];
        k = ceil(fs.*3./ft./2);
        mean_sig = [1   800];
        dynamic_displacement = zeros(N, 3);

        for col = 1:3
            clear time cap_shk
            ax_sk = data(:, col);
            Ax_real_sk = (ax_sk*aRes+0.032)*9.81;
            Ax_real_sk_1024= Ax_real_sk;
            for i = 1:1
                r = k(i);
                Nd = 2*k(i)+1;
                Lc = zeros(Nd, Nd+2);
                Lc(:,1:Nd)   = Lc(:,1:Nd)   +   eye(Nd);
                Lc(:,3:Nd+2) = Lc(:,3:Nd+2) +   eye(Nd);
                Lc(:,2:Nd+1) = Lc(:,2:Nd+1) - 2*eye(Nd);
                La = eye(Nd);
                La(1) = 1/sqrt(2);
                La(end) = 1/sqrt(2);
                L = La*Lc;
                lambda = 46.81*Nd^(-1.95);
                Ca2d = (L'*L+lambda^2*eye(Nd+2))\(L'*La);
                Ca2drp2 = Ca2d(r+2,:);
                cap_shk1 = -Ax_real_sk_1024;
                for m = 1:length(t_sk)
                    time(m) = t_sk(m);
                    cap_shk(m)=cap_shk1(m);
                end
                time =  time';
                cap_shk = cap_shk';
                cap_shk = cap_shk - mean(cap_shk(mean_sig(i,1):mean_sig(i,2)));
                ddxt1 = cap_shk;
                xtr1 = zeros(size(ddxt1));
                for j=r+1:length(ddxt1)-r
                    xtr1(j) = Ca2drp2*ddxt1(j-r:j+r)*dt2;
                end
                dynamic_displacement_shk = -xtr1*1000;
            end
            dynamic_displacement(:, col) = dynamic_displacement_shk;
        end

        result.displacement_x = dynamic_displacement(:, 1);
        result.displacement_y = dynamic_displacement(:, 2);
        result.displacement_z = dynamic_displacement(:, 3);

    else
        error('Unknown filter type: %s', filter_type);
    end

    fields = fieldnames(result);
    for i = 1:numel(fields)
        if isnumeric(result.(fields{i}))
            result.(fields{i}) = round(result.(fields{i}), 6);
        end
    end
    result.elapsed = toc;

    save(strcat('/filter_staging/filtered/', file_name, '.mat'), '-struct', 'result');
    response = 'success';
end